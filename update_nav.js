const fs = require('fs');
const path = 'c:\\Users\\Juanb\\OneDrive\\Escritorio\\Tactics Bloxugan\\src\\App.tsx';

let content = fs.readFileSync(path, 'utf8');

const target = '            <a href="#" className={activeTab === \'community\' ? \'active\' : \'\'} onClick={(e) => { e.preventDefault(); setActiveTab(\'community\'); setIsMobileMenuOpen(false); }}>Comunidad</a>';
const replacement = target + '\n            <a href="#" onClick={(e) => { e.preventDefault(); setShowDonationModal(true); setIsMobileMenuOpen(false); }} style={{ color: "var(--accent-color)", fontWeight: "bold", display: "flex", alignItems: "center", gap: "0.2rem" }}>Donar <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="var(--accent-color)" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-heart"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></a>';

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log("Replacement Success");
} else {
    console.log("Target not found");
}
