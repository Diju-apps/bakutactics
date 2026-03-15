import fs from 'fs';

const path = 'c:\\Users\\Juanb\\OneDrive\\Escritorio\\Tactics Bloxugan\\src\\App.tsx';

let content = fs.readFileSync(path, 'utf8');

const target = 'const PAYPAL_DONATION_URL = "https://www.paypal.com/donate/?hosted_button_id=TU_BUTTON_ID"; // O "https://paypal.me/tu-usuario"';
const replacement = 'const PAYPAL_DONATION_URL = "https://paypal.me/juanbo795";';

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log("Replacement Success");
} else {
    // try removing the comment-spaced variant if I had any spacing issues
    const lines = content.split('\n');
    let replaced = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('const PAYPAL_DONATION_URL =')) {
            lines[i] = 'const PAYPAL_DONATION_URL = "https://paypal.me/juanbo795";';
            replaced = true;
            break;
        }
    }
    if (replaced) {
        fs.writeFileSync(path, lines.join('\n'), 'utf8');
        console.log("Fallback Replacement Success");
    } else {
        console.log("Target not found");
    }
}
