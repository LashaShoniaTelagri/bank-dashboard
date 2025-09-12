import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";

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

  const addLoan = () => {
    if (loans.length >= 15) return
    onChange([...loans, { amount: '', currency: '', start_date: '', end_date: '', issuance_date: '' }])
  }

  const updateLoan = (idx: number, next: Partial<Loan>) => {
    const copy = loans.slice()
    copy[idx] = { ...copy[idx], ...next }
    onChange(copy)
  }

  const removeLoan = (idx: number) => {
    const copy = loans.slice()
    copy.splice(idx, 1)
    onChange(copy)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Loan Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loans.map((loan, idx) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div>
              <Label>Amount</Label>
              <Input type="number" min="0" value={loan.amount} onChange={e => updateLoan(idx, { amount: e.target.value === '' ? '' : parseFloat(e.target.value) })} />
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={loan.currency} onValueChange={(v: any) => updateLoan(idx, { currency: v })}>
                <SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GEL">GEL</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start date</Label>
              <Input type="date" value={loan.start_date} onChange={e => updateLoan(idx, { start_date: e.target.value })} />
            </div>
            <div>
              <Label>End date</Label>
              <Input type="date" value={loan.end_date} onChange={e => updateLoan(idx, { end_date: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label>Issuance date</Label>
                <Input type="date" value={loan.issuance_date} onChange={e => updateLoan(idx, { issuance_date: e.target.value })} />
              </div>
              <Button type="button" variant="outline" onClick={() => removeLoan(idx)}>Remove</Button>
            </div>
          </div>
        ))}
        <div className="flex justify-end">
          <Button type="button" onClick={addLoan} disabled={loans.length >= 15}>Add Another Loan</Button>
        </div>
      </CardContent>
    </Card>
  )
}

