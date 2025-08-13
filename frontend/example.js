const markdownExample = `# Markdown zu Word

## Was ist Markdown?

**Markdown** ist eine leicht verständliche Auszeichnungssprache zum Formatieren von Texten, welche mit **Sternchen**, \`Backticks\` und anderen Sonderzeichen arbeitet.  
Gerade **KI-Tools** nutzen Markdown, um Texte übersichtlich zu strukturieren.

## Das Problem besteht beim Übertrag nach Microsoft Word

KI-Tools können Texte **perfekt in Markdown formatieren** – Überschriften, Listen, Tabellen – alles sieht im Browser gut aus.  
**Doch wenn du den Text in eine Word-Datei kopierst:**
- Nur einfache **Fettschrift** und *Kursiv* bleiben erhalten  
- Überschriften sind keiner Formatvorlage zugeornet
- Aufzählungszeichen und nummerierte Listen werden als normaler Text eingefügt
- Tabellen werden fehlerhaft angezeigt

**Das heißt für dich:**  
Viel manuelle Nacharbeit – besonders bei langen Dokumenten nervig und fehleranfällig.

## Die Lösung

Dieses Tool wandelt Markdown **vollautomatisch** in professionelle Word-Dokumente um –  
und nutzt dabei **deine eigenen Word-Templates** für perfektes Corporate Design.

### So funktioniert's

| Markdown | Word-Formatvorlage | Ergebnis |
|----------|-------------------|----------|
| \`# Überschrift\` | Überschrift 1 | Große Überschrift |
| \`## Unterüberschrift\` | Überschrift 2 | Mittlere Überschrift |
| \`### Abschnitt\` | Überschrift 3 | Kleine Überschrift |
| \`**fett**\` | Fett | **Fettschrift** |
| \`*kursiv*\` | Kursiv | *Kursivschrift* |
| \`- Aufzählung\` | List Paragraph | • Listenpunkt |
| \`1. Nummeriert\` | List Number | 1. Nummerierter Punkt |
| \`> Zitat\` | Quote | Eingerücktes Zitat |
| \`\\\`Code\\\`\` | Source Code | Monospace-Text |
| \`| Tabelle |\` | Table Grid | Formatierte Tabelle |

> Das Tool erkennt deine Word-Formatvorlagen automatisch und mappt Markdown-Elemente direkt darauf.

## Vorteile

1. **Eigene Templates**: Nutze deine vorhandenen Word-Vorlagen  
2. **Individuelles Design**: Farben, Schriften, Abstände – alles nach deinem CI  
3. **Konsistenz**: Einheitliche Formatierung in allen Dokumenten  
4. **Effizienz**: Keine manuelle Nachbearbeitung mehr  

## Perfekt für KI-Workflows

**So läuft’s ab:**
1. **KI beauftragen**: "Erstelle einen Projektbericht in Markdown"  
2. **Antwort kopieren**: Direkt ins Tool einfügen  
3. **Vorlage auswählen**: Dein Firmen-Template laden  
4. **Konvertieren**: Fertiges Word-Dokument herunterladen  

**Nie wieder manuell formatieren!** Von der KI-Antwort zum professionellen Dokument in Sekunden.
`;

function typeTextInPlaceholder(element, text, duration = 1800) {
    element.placeholder = '';
    
    // Split text into lines and find first 12 lines
    const lines = text.split('\n');
    const first12Lines = lines.slice(0, 12).join('\n');
    const remainingLines = lines.slice(12).join('\n');
    
    let currentIndex = 0;
    const totalChars = first12Lines.length;
    const maxDuration = Math.min(duration, 1800);
    const intervalTime = maxDuration / totalChars;
    
    const typeInterval = setInterval(() => {
        if (currentIndex < totalChars) {
            element.placeholder = first12Lines.substring(0, currentIndex + 1);
            currentIndex++;
        } else {
            // Animation finished - add remaining text instantly
            clearInterval(typeInterval);
            if (remainingLines) {
                element.placeholder = first12Lines + '\n' + remainingLines;
            }
        }
    }, intervalTime);
}

function startTypingDemo() {
    const textArea = document.getElementById('markdown-input');
    if (textArea) {
        // Clear placeholder when user starts typing
        textArea.addEventListener('input', () => {
            if (textArea.value.length > 0) {
                textArea.placeholder = 'Gebe hier deinen Markdown-Text ein...';
            }
        });
        
        // Wait 500ms after page load, then start typing in placeholder
        setTimeout(() => {
            typeTextInPlaceholder(textArea, markdownExample, 1200);
        }, 500);
    }
}

// Make markdownExample globally available
window.markdownExample = markdownExample;

// Auto-start when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startTypingDemo);
} else {
    startTypingDemo();
}