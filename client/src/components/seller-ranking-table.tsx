import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { SellerRankingEntry } from "@/hooks/use-seller-ranking";
import { Trophy } from "lucide-react";

interface SellerRankingTableProps {
    data?: SellerRankingEntry[];
    isLoading: boolean;
    schoolName: string;
    periodLabel: string;
}

const BRL = (val: number) =>
    val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const PCT = (val: number) =>
    val.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";

export function SellerRankingTable({ data, isLoading, schoolName, periodLabel }: SellerRankingTableProps) {
    return (
        <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                <div>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-primary" />
                        Ranking de Vendedores
                    </CardTitle>
                    <CardDescription>
                        {schoolName} · {periodLabel}
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </div>
                ) : !data || data.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                        Nenhum dado encontrado para o período.
                    </p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12 text-center">Pos</TableHead>
                                <TableHead>Vendedor</TableHead>
                                <TableHead className="text-right">Novas Matrículas</TableHead>
                                <TableHead className="text-right">Receita Gerada</TableHead>
                                <TableHead className="text-right">Taxa de Conversão Pessoal</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.map((row, index) => (
                                <TableRow key={row.sellerId}>
                                    <TableCell className="text-center font-medium">
                                        {index + 1}º
                                    </TableCell>
                                    <TableCell className="font-medium">{row.sellerName}</TableCell>
                                    <TableCell className="text-right">{row.enrollments}</TableCell>
                                    <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-medium">
                                        {BRL(row.revenue)}
                                    </TableCell>
                                    <TableCell className="text-right">{PCT(row.conversionRate)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
