/**
 * Parse a date string from UCloud (typically "yyyy-MM-dd HH:mm:ss" in CST)
 * and return a Date object.
 */
export function parseUcloudDate(dateStr: string): Date {
	if (!dateStr) return new Date();

	// UCloud dates are in CST (Beijing Time, UTC+8).
	// If the string doesn't have a timezone indicator, we append +08:00.
	if (
		!dateStr.includes("T") &&
		!dateStr.includes("+") &&
		!dateStr.endsWith("Z")
	) {
		// Replace space with T to make it closer to ISO format
		const isoLike = dateStr.replace(" ", "T");
		return new Date(`${isoLike}+08:00`);
	}

	return new Date(dateStr);
}
