export function sanitizeFilenamePart(value) {
    const safe = String(value || '')
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, ' ')
        .trim();
    return safe || 'Untitled';
}

export function yamlEscapeScalar(value) {
    return String(value || '').replace(/"/g, '\\"');
}

export function dedupeCharacterNames(names = []) {
    const seen = new Set();
    const unique = [];

    for (const name of names) {
        const clean = String(name || '').trim();
        if (!clean) continue;

        const key = clean.toLowerCase();
        if (seen.has(key)) continue;

        seen.add(key);
        unique.push(clean);
    }

    return unique;
}

export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
