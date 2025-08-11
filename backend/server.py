from flask import Flask, request, jsonify, send_file
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

app = Flask(__name__)
CORS(app)

# Configure maximum file upload size
app.config['MAX_CONTENT_LENGTH'] = 25 * 1024 * 1024

# Configure Pandoc path
pandoc_path = os.path.join(os.getcwd(), 'pandoc')
if not os.path.exists(pandoc_path):
    os.makedirs(pandoc_path)

if sys.platform == "win32":
    pandoc_binary = os.path.join(pandoc_path, 'pandoc.exe')
else:
    pandoc_binary = os.path.join(pandoc_path, 'pandoc')

os.environ['PYPANDOC_PANDOC'] = pandoc_binary

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint um zu prüfen ob die API online ist"""
    return jsonify({"status": "ok", "message": "API is online"}), 200

@app.route('/api/upload-template', methods=['POST'])
def upload_template():
    """Upload eines benutzerdefinierten Templates"""
    try:
        if 'template' not in request.files:
            return jsonify({"error": "Keine Datei ausgewählt"}), 400
        
        file = request.files['template']
        if file.filename == '':
            return jsonify({"error": "Keine Datei ausgewählt"}), 400
        
        # Validate file extension
        if not file.filename.lower().endswith(('.docx', '.doc')):
            return jsonify({"error": "Nur .docx und .doc Dateien sind erlaubt"}), 400
        
        # Clear and recreate user templates directory
        user_templates_dir = 'user-templates'
        if os.path.exists(user_templates_dir):
            shutil.rmtree(user_templates_dir)
        os.makedirs(user_templates_dir, exist_ok=True)
        filename = secure_filename(file.filename)
        filepath = os.path.join(user_templates_dir, filename)
        file.save(filepath)
        
        return jsonify({"message": "Template erfolgreich hochgeladen", "filename": filename}), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/templates', methods=['GET'])
def get_templates():
    """Gibt die verfügbaren Templates zurück"""
    try:
        with open(os.path.join('templates', 'index.json'), 'r', encoding='utf-8') as f:
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
        data = request.json
        markdown_content = data.get('markdown', '')
        template_id = data.get('template_id', '')
        
        if not markdown_content:
            return jsonify({"error": "Kein Markdown-Inhalt gefunden"}), 400
        
        if not template_id:
            return jsonify({"error": "Keine Template-ID angegeben"}), 400
        
        # Handle user template or standard template
        if template_id == '__custom__':
            user_templates_dir = 'user-templates'
            if not os.path.exists(user_templates_dir):
                return jsonify({"error": "Kein benutzerdefiniertes Template gefunden"}), 404
            
            # Find first available template file
            template_files = glob.glob(os.path.join(user_templates_dir, '*.docx'))
            if not template_files:
                template_files = glob.glob(os.path.join(user_templates_dir, '*.doc'))
            
            if not template_files:
                return jsonify({"error": "Kein benutzerdefiniertes Template gefunden"}), 404
            
            template_file = template_files[0]
            template_description = "Benutzerdefiniertes Template"
        else:
            # Load standard template configuration
            with open(os.path.join('templates', 'index.json'), 'r', encoding='utf-8') as f:
                templates = json.load(f)
            
            # Find template by filename (without extension)
            template_info = None
            for template in templates:
                template_id_from_filename = os.path.splitext(template['filename'])[0]
                if template_id_from_filename == template_id:
                    template_info = template
                    break
            
            if not template_info:
                return jsonify({"error": "Template nicht gefunden"}), 404
            
            template_file = os.path.join('templates', template_info['filename'])
            template_description = template_info['description']
        
        # Create temporary files for conversion
        temp_dir = tempfile.gettempdir()
        unique_id = str(uuid.uuid4())
        input_file = os.path.join(temp_dir, f"input_{unique_id}.md")
        
        # Write markdown content to temporary file
        with open(input_file, 'w', encoding='utf-8') as f:
            f.write(markdown_content)
        
        # Configure output file and pandoc parameters
        output_file = os.path.join(temp_dir, f"output_{unique_id}.docx")
        pandoc_format = 'docx'
        extra_args = ['--reference-doc', template_file]
        
        # Convert markdown to docx using template
        pypandoc.convert_file(
            input_file, 
            pandoc_format, 
            outputfile=output_file, 
            extra_args=extra_args
        )
        
        # Clean up temporary input file
        os.remove(input_file)
        return send_file(
            output_file, 
            as_attachment=True, 
            download_name=f"{template_description}.docx",
            mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Ensure templates directory exists
    if not os.path.exists('templates'):
        os.makedirs('templates')
    
    app.run(host='0.0.0.0', port=8081, debug=True)