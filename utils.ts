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
