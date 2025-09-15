import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface RefreshIntervalSelectProps {
  value: number;
  onChange: (interval: number) => void;
}

const intervals = [
  { value: 1000, label: '1s' },
  { value: 2000, label: '2s' },
  { value: 3000, label: '3s' },
  { value: 5000, label: '5s' },
  { value: 10000, label: '10s' },
];

export const RefreshIntervalSelect = ({ value, onChange }: RefreshIntervalSelectProps) => {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="refresh-interval" className="text-sm font-medium text-foreground whitespace-nowrap">
        Refresh:
      </Label>
      <Select value={value.toString()} onValueChange={(val) => onChange(parseInt(val))}>
        <SelectTrigger id="refresh-interval" className="w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {intervals.map((interval) => (
            <SelectItem key={interval.value} value={interval.value.toString()}>
              {interval.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};