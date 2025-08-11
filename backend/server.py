from flask import Flask, request, jsonify, send_file, after_this_request
from flask_cors import CORS
import pypandoc
import os
import sys
import json
import tempfile
import uuid
import shutil
import glob
from werkzeug.utils import secure_filename

# --- Pfade robust relativ zur Datei ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(BASE_DIR, 'templates')
USER_TEMPLATES_DIR = os.path.join(BASE_DIR, 'user-templates')
PANDOC_DIR = os.path.join(BASE_DIR, 'pandoc')

os.makedirs(TEMPLATES_DIR, exist_ok=True)
os.makedirs(USER_TEMPLATES_DIR, exist_ok=True)
os.makedirs(PANDOC_DIR, exist_ok=True)

# Pandoc-Binary & Env für pypandoc
pandoc_binary = os.path.join(PANDOC_DIR, 'pandoc' + ('.exe' if sys.platform == 'win32' else ''))
os.environ['PYPANDOC_PANDOC'] = pandoc_binary  # von pypandoc ausgewertet

app = Flask(__name__)
CORS(app)

# Max Upload (25 MB)
app.config['MAX_CONTENT_LENGTH'] = 25 * 1024 * 1024


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    exists = os.path.isfile(pandoc_binary)
    exec_ok = exists and os.access(pandoc_binary, os.X_OK)
    return jsonify({
        "status": "ok",
        "message": "API is online",
        "pandoc": {
            "path": pandoc_binary,
            "exists": exists,
            "executable": exec_ok
        }
    }), 200


@app.route('/api/upload-template', methods=['POST'])
def upload_template():
    """Upload eines benutzerdefinierten Templates"""
    try:
        if 'template' not in request.files:
            return jsonify({"error": "Keine Datei ausgewählt"}), 400

        file = request.files['template']
        if file.filename == '':
            return jsonify({"error": "Keine Datei ausgewählt"}), 400

        if not file.filename.lower().endswith(('.docx', '.doc')):
            return jsonify({"error": "Nur .docx und .doc Dateien sind erlaubt"}), 400

        # Ordner leeren & neu anlegen (genau ein aktives User-Template)
        if os.path.exists(USER_TEMPLATES_DIR):
            shutil.rmtree(USER_TEMPLATES_DIR)
        os.makedirs(USER_TEMPLATES_DIR, exist_ok=True)

        filename = secure_filename(file.filename)
        filepath = os.path.join(USER_TEMPLATES_DIR, filename)
        file.save(filepath)

        return jsonify({"message": "Template erfolgreich hochgeladen", "filename": filename}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/templates', methods=['GET'])
def get_templates():
    """Gibt die verfügbaren Templates zurück"""
    try:
        index_path = os.path.join(TEMPLATES_DIR, 'index.json')
        with open(index_path, 'r', encoding='utf-8') as f:
            templates = json.load(f)
        return jsonify(templates)
    except FileNotFoundError:
        return jsonify({"error": "Templates nicht gefunden"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/convert', methods=['POST'])
def convert_markdown():
    """Konvertiert Markdown in Word/OneNote Format"""
    try:
        data = request.json or {}
        markdown_content = data.get('markdown', '')
        template_id = data.get('template_id', '')

        if not markdown_content:
            return jsonify({"error": "Kein Markdown-Inhalt gefunden"}), 400
        if not template_id:
            return jsonify({"error": "Keine Template-ID angegeben"}), 400

        # Pandoc vorhanden & ausführbar?
        if not os.path.isfile(pandoc_binary):
            return jsonify({"error": f"Pandoc-Binary nicht gefunden: {pandoc_binary}"}), 500
        if not os.access(pandoc_binary, os.X_OK):
            try:
                os.chmod(pandoc_binary, 0o755)
            except Exception:
                return jsonify({"error": f"Pandoc-Binary ist nicht ausführbar: {pandoc_binary}"}), 500

        # Template bestimmen
        if template_id == '__custom__':
            files = glob.glob(os.path.join(USER_TEMPLATES_DIR, '*.docx')) or \
                    glob.glob(os.path.join(USER_TEMPLATES_DIR, '*.doc'))
            if not files:
                return jsonify({"error": "Kein benutzerdefiniertes Template gefunden"}), 404
            template_file = files[0]
            template_description = "Benutzerdefiniertes Template"
        else:
            index_path = os.path.join(TEMPLATES_DIR, 'index.json')
            with open(index_path, 'r', encoding='utf-8') as f:
                templates = json.load(f)

            template_info = None
            for t in templates:
                template_id_from_filename = os.path.splitext(t['filename'])[0]
                if template_id_from_filename == template_id:
                    template_info = t
                    break

            if not template_info:
                return jsonify({"error": "Template nicht gefunden"}), 404

            template_file = os.path.join(TEMPLATES_DIR, template_info['filename'])
            if not os.path.isfile(template_file):
                return jsonify({"error": f"Template-Datei fehlt: {template_file}"}), 404
            template_description = template_info.get('description', template_id)

        # Temp-Dateien
        temp_dir = tempfile.gettempdir()
        unique_id = str(uuid.uuid4())
        input_file = os.path.join(temp_dir, f"input_{unique_id}.md")
        output_file = os.path.join(temp_dir, f"output_{unique_id}.docx")

        # Markdown schreiben
        with open(input_file, 'w', encoding='utf-8') as f:
            f.write(markdown_content)

        # Cleanup nach Response
        @after_this_request
        def _cleanup_files(response):
            for p in (input_file, output_file):
                try:
                    if os.path.exists(p):
                        os.remove(p)
                except Exception:
                    pass
            return response

        # Konvertieren (mit Reference-Doc)
        extra_args = ['--reference-doc', template_file]
        pypandoc.convert_file(
            input_file,
            'docx',
            outputfile=output_file,
            extra_args=extra_args
        )

        return send_file(
            output_file,
            as_attachment=True,
            download_name=f"{template_description}.docx",
            mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8081, debug=True)
