#!/usr/bin/env python3
import http.server
import socketserver
import os
import sys

# Port und Pfad konfigurieren
PORT = 5500
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend')

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

if __name__ == "__main__":
    # Prüfen ob Frontend-Ordner existiert
    if not os.path.exists(FRONTEND_DIR):
        print(f"Fehler: Frontend-Ordner nicht gefunden: {FRONTEND_DIR}")
        sys.exit(1)
    
    print(f"Frontend-Ordner: {os.path.abspath(FRONTEND_DIR)}")
    print(f"Server startet auf Port {PORT}")
    print(f"Frontend erreichbar unter: http://localhost:{PORT}")
    print("Drücke Strg+C zum Beenden")
    
    try:
        with socketserver.TCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer beendet.")
    except Exception as e:
        print(f"Fehler beim Starten des Servers: {e}")