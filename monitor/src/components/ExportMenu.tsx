import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Mail } from "lucide-react";

interface ExportMenuProps {
    onExport: (target: "pdf" | "excel" | "outlook") => void;
    disabled?: boolean;
    label?: string;
    size?: "sm" | "default" | "icon";
}

export function ExportMenu({ onExport, disabled, label = "Export", size = "sm" }: ExportMenuProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size={size}
                    disabled={disabled}
                    className="border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 h-8 text-[0.8125rem]"
                >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    {label}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => onExport("pdf")} className="cursor-pointer text-[0.8125rem]">
                    <FileText className="h-3.5 w-3.5 mr-2 text-red-500" />
                    Export to PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport("excel")} className="cursor-pointer text-[0.8125rem]">
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-2 text-green-600" />
                    Export to Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport("outlook")} className="cursor-pointer text-[0.8125rem]">
                    <Mail className="h-3.5 w-3.5 mr-2 text-blue-500" />
                    Send via Outlook
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
