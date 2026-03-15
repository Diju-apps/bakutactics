import os

path = r'c:\Users\Juanb\OneDrive\Escritorio\Tactics Bloxugan\src\App.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '            <a href="#" className={activeTab === \'community\' ? \'active\' : \'\'} onClick={(e) => { e.preventDefault(); setActiveTab(\'community\'); setIsMobileMenuOpen(false); }}>Comunidad</a>'
replacement = target + '\n            <a href="#" onClick={(e) => { e.preventDefault(); setShowDonationModal(true); setIsMobileMenuOpen(false); }} style={{ color: "var(--accent-color)", fontWeight: "bold", display: "flex", alignItems: "center", gap: "0.3rem" }}>Donar <Heart size={14} fill="var(--accent-color)" /></a>'

if target in content:
    content = content.replace(target, replacement)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replacement Success")
else:
    print("Target not found in content")
