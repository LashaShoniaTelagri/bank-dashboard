import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Plus, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type Loan = {
  id?: string
  amount: number | ''
  currency: 'GEL' | 'USD' | 'EUR' | ''
  start_date: string
  end_date: string
  issuance_date: string
}

type Props = {
  loans: Loan[]
  onChange: (loans: Loan[]) => void
}

export default function LoansEditor({ loans, onChange }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  // Ensure there's always at least one loan by default
  const displayLoans: Loan[] = loans.length === 0 ? [{ amount: '', currency: '', start_date: '', end_date: '', issuance_date: '' }] : loans

  const addLoan = () => {
    if (loans.length >= 15) return
    onChange([...loans, { amount: '', currency: '', start_date: '', end_date: '', issuance_date: '' }])
  }

  const updateLoan = (idx: number, next: Partial<Loan>) => {
    const copy = displayLoans.slice()
    copy[idx] = { ...copy[idx], ...next }
    onChange(copy)
  }

  const removeLoan = (idx: number) => {
    if (displayLoans.length === 1) return // Don't allow removing the last loan
    const copy = displayLoans.slice()
    copy.splice(idx, 1)
    onChange(copy)
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Loan Details</CardTitle>
          <Button 
            type="button" 
            onClick={addLoan} 
            disabled={displayLoans.length >= 15}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="h-4 w-4" />
            Add Another Loan
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {displayLoans.map((loan, idx) => (
            <div key={idx} className="space-y-3 p-6 border border-gray-200 rounded-lg bg-gray-50">
              {/* Input fields in one horizontal line */}
              <div className="grid grid-cols-1 lg:grid-cols-6 gap-6 items-end">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Amount</Label>
                  <Input 
                    type="number" 
                    min="0" 
                    value={loan.amount} 
                    onChange={e => updateLoan(idx, { amount: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                    placeholder="Enter amount"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Currency</Label>
                  <Select value={loan.currency} onValueChange={(v: any) => updateLoan(idx, { currency: v })}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GEL">GEL</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Start date</Label>
                  <DatePicker
                    value={loan.start_date}
                    onChange={(date) => {
                      updateLoan(idx, { start_date: date });
                      // If end date is before new start date, clear it
                      if (loan.end_date && new Date(loan.end_date) <= new Date(date)) {
                        updateLoan(idx, { end_date: '' });
                      }
                    }}
                    placeholder="Start date"
                    maxDate={loan.end_date ? new Date(loan.end_date) : undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">End date</Label>
                  <DatePicker
                    value={loan.end_date}
                    onChange={(date) => updateLoan(idx, { end_date: date })}
                    placeholder="End date"
                    minDate={loan.start_date ? new Date(new Date(loan.start_date).getTime() + 24 * 60 * 60 * 1000) : undefined}
                    disabled={!loan.start_date}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Issuance date</Label>
                  <DatePicker
                    value={loan.issuance_date}
                    onChange={(date) => updateLoan(idx, { issuance_date: date })}
                    placeholder="Issuance date"
                  />
                </div>
                <div className="flex justify-end items-end h-[42px]">
                  {displayLoans.length > 1 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="icon"
                          onClick={() => removeLoan(idx)}
                          className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}

