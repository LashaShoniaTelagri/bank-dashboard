import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { calculate, ALLOWED_CROPS, resolveTariff, type Selection } from "@/lib/serviceCost";

type Props = {
  value: Selection
  onChange: (next: Selection, result?: { tariff: string; total: number }) => void
  onNext?: () => void
}

const T1_OPTIONS = {
  area: ['0–5 ha','6–10 ha','11–15 ha','16–20 ha','21–30 ha','31–40 ha','41–50 ha','51–70 ha','71–100 ha','101–150 ha','151–200 ha','201–300 ha','301–500 ha','Over 500 hectares'],
  reservoirs: ['0–1','2','3','4','5','6 or more'],
  outermostDistance: ['Less than 100 m.','100–300 m.','300 m – 1 km','1–3 km','More than 3 km'],
  plantAges: ['1','2','3','4','5','6','7','8','9','More than 10'],
  varieties: ['1','2','3','4','5','6','7','8','9','More than 10'],
  roadDistance: ['Up to 1 km','1–3 km','3–10 km','More than 10 km']
}

const T2_OPTIONS = {
  area: ['0–5 ha','6–10 ha','11–15 ha','16–20 ha','21–30 ha','31–40 ha','41–50 ha','51–70 ha','71–100 ha','101–150 ha','151–200 ha','201–300 ha','301–500 ha','> 500 ha'],
  reservoirs: ['0–1','2','3','4','5'],
  outermostDistance: ['Less than 100 m','100–300 m','300 m – 1 km','1 km – 3 km','More than 3 km'],
  plantAges: ['1','2','3','4','5','6','7','8','9','More than 10'],
  varieties: ['1','2','3','4','5','6','7','8','9','More than 10'],
  roadDistance: ['Up to 1 km','1–3 km','3–10 km','More than 10 km']
}

export function ServiceCostCalculator({ value, onChange, onNext }: Props) {
  const tariff = useMemo(() => resolveTariff(value.crop), [value.crop])
  const opts = tariff === 'T1' ? T1_OPTIONS : T2_OPTIONS

  const isComplete = Boolean(value.crop && value.area && value.reservoirs && value.outermostDistance && value.plantAges && value.varieties && value.roadDistance)

  const result = useMemo(() => isComplete ? calculate(value) : null, [isComplete, value])

  const handleField = (field: keyof Selection, v: string) => {
    const next = { ...value, [field]: v }
    const calc = calculate(next)
    onChange(next, { tariff: calc.tariff, total: calc.total })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Cost Calculation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Crop <span className="text-red-500">*</span>
            </Label>
            <Select value={value.crop} onValueChange={(v) => handleField('crop', v)}>
              <SelectTrigger><SelectValue placeholder="Select crop" /></SelectTrigger>
              <SelectContent>
                {ALLOWED_CROPS.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Area <span className="text-red-500">*</span>
            </Label>
            <Select value={value.area} onValueChange={(v) => handleField('area', v)}>
              <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
              <SelectContent>
                {opts.area.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Number of reservoirs <span className="text-red-500">*</span>
            </Label>
            <Select value={value.reservoirs} onValueChange={(v) => handleField('reservoirs', v)}>
              <SelectTrigger><SelectValue placeholder="Select count" /></SelectTrigger>
              <SelectContent>
                {opts.reservoirs.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Longest distance between two outermost plots <span className="text-red-500">*</span>
            </Label>
            <Select value={value.outermostDistance} onValueChange={(v) => handleField('outermostDistance', v)}>
              <SelectTrigger><SelectValue placeholder="Select distance" /></SelectTrigger>
              <SelectContent>
                {opts.outermostDistance.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Number of different plant ages cultivated <span className="text-red-500">*</span>
            </Label>
            <Select value={value.plantAges} onValueChange={(v) => handleField('plantAges', v)}>
              <SelectTrigger><SelectValue placeholder="Select count" /></SelectTrigger>
              <SelectContent>
                {opts.plantAges.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Number of varieties cultivated <span className="text-red-500">*</span>
            </Label>
            <Select value={value.varieties} onValueChange={(v) => handleField('varieties', v)}>
              <SelectTrigger><SelectValue placeholder="Select count" /></SelectTrigger>
              <SelectContent>
                {opts.varieties.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label className="text-sm font-medium">
              Approx. distance from nearest sector to asphalt road <span className="text-red-500">*</span>
            </Label>
            <Select value={value.roadDistance} onValueChange={(v) => handleField('roadDistance', v)}>
              <SelectTrigger><SelectValue placeholder="Select distance" /></SelectTrigger>
              <SelectContent>
                {opts.roadDistance.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-muted/30 sticky bottom-0 bg-white/95 backdrop-blur-sm">
          <div className="text-sm font-medium text-muted-foreground mb-2">Service Cost</div>
          {result ? (
            <div className="space-y-1">
              <div className="text-2xl lg:text-3xl font-bold text-green-600">€{result.total.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">
                Service cost calculated
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-xl lg:text-2xl font-semibold text-muted-foreground">€ --</div>
              <div className="text-sm text-muted-foreground">
                Complete all fields above to calculate service cost
              </div>
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  )
}

export default ServiceCostCalculator

