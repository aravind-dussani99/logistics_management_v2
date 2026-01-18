/**
 * Safely formats a number to a fixed number of decimal places without grouping/commas.
 * If the input is not a valid number, it returns a string like '0.00'.
 * This is more robust than native .toFixed() for handling different number-like inputs.
 * @param value The number to format.
 * @param digits The number of decimal places.
 * @returns A formatted string.
 */
export const safeToFixed = (value: any, digits: number = 2): string => {
    const num = Number(value);
    if (isNaN(num)) {
        return (0).toFixed(digits);
    }
    // Using toLocaleString with 'en-US' locale and no grouping is a robust way to get toFixed behavior
    return num.toLocaleString('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
        useGrouping: false
    });
};

/**
 * Safely formats a number as Indian Rupee currency.
 * If the input is not a valid number, it returns '₹0.00'.
 * @param value The number to format.
 * @returns A formatted currency string.
 */
export const formatCurrency = (value: any): string => {
    const num = Number(value);
    if (isNaN(num)) {
        return '₹0.00';
    }
    // Using Intl.NumberFormat for proper Indian comma separation (lakhs, crores)
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
};

/**
 * Formats a date string into dd/mm/yyyy for display.
 * Returns the original value when parsing fails.
 */
export const formatDateDisplay = (value?: string): string => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

const normalizeMatchKey = (value: string): string =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, '');

const levenshteinDistance = (a: string, b: string): number => {
    if (a === b) return 0;
    if (!a) return b.length;
    if (!b) return a.length;
    const matrix: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
    for (let i = 1; i <= a.length; i += 1) {
        for (let j = 1; j <= b.length; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }
    return matrix[a.length][b.length];
};

export const findBestFuzzyMatch = (
    input: string,
    candidates: string[],
    maxDistanceRatio: number = 0.34
): { name: string; ratio: number } | null => {
    const normalizedInput = normalizeMatchKey(input);
    if (!normalizedInput) return null;
    let bestMatch: { name: string; ratio: number } | null = null;
    candidates.forEach(candidate => {
        const normalizedCandidate = normalizeMatchKey(candidate);
        if (!normalizedCandidate) return;
        const distance = levenshteinDistance(normalizedInput, normalizedCandidate);
        const ratio = distance / Math.max(normalizedInput.length, normalizedCandidate.length, 1);
        if (!bestMatch || ratio < bestMatch.ratio) {
            bestMatch = { name: candidate, ratio };
        }
    });
    if (bestMatch && bestMatch.ratio <= maxDistanceRatio) {
        return bestMatch;
    }
    return null;
};

export const normalizeMatchValue = (value?: string): string =>
    (value || '').trim().replace(/\s+/g, ' ');
