export function exportToCsv<T>(filename: string, data: T[], headers?: { label: string; key: keyof T }[]) {
    if (!data || !data.length) {
        return;
    }

    // If no headers provided, try to extract from keys of first object
    const columns = headers || Object.keys(data[0] as object).map((key) => ({ label: key, key: key as keyof T }));

    const csvContent = [
        columns.map((col) => `"${String(col.label).replace(/"/g, '""')}"`).join(","),
        ...data.map((row) =>
            columns
                .map((col) => {
                    let val = row[col.key];
                    // Handle specific object types or stringify
                    if (val === null || val === undefined) {
                        val = "" as any;
                    } else if (typeof val === "object") {
                        val = JSON.stringify(val) as any;
                    }
                    return `"${String(val).replace(/"/g, '""')}"`;
                })
                .join(",")
        ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
