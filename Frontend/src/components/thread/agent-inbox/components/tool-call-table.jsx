import { unknownToPrettyDate } from "../utils";

export function ToolCallTable({ toolCall }) {
    return (
        <div className="max-w-full min-w-[200px] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-zinc-100 border-b border-zinc-200">
                        <th
                            className="px-3 py-1.5 text-left text-xs font-bold text-zinc-700 uppercase tracking-tight"
                            colSpan={2}
                        >
                            Tool: {toolCall.name}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {Object.entries(toolCall.args || {}).map(([key, value]) => {
                        let valueStr = "";
                        if (["string", "number"].includes(typeof value)) {
                            valueStr = value.toString();
                        }

                        const date = unknownToPrettyDate(value);
                        if (date) {
                            valueStr = date;
                        }

                        try {
                            valueStr = valueStr || JSON.stringify(value, null);
                        } catch (_) {
                            valueStr = "";
                        }

                        return (
                            <tr
                                key={key}
                                className="border-t border-zinc-100 last:border-0"
                            >
                                <td className="w-1/3 px-3 py-1.5 text-xs font-semibold text-zinc-500 bg-zinc-50/50">{key}</td>
                                <td className="px-3 py-1.5 font-mono text-[11px] text-zinc-700 break-all whitespace-pre-wrap">{valueStr}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
