import { PackingSlip } from '../types/packingSlip';
import PackingSlipLayout from './PackingSlipLayout';

interface PrintablePackingSlipProps {
  packingSlip: PackingSlip;
}

export default function PrintablePackingSlip({ packingSlip }: PrintablePackingSlipProps) {
  return (
    <div className="w-full bg-white" style={{ width: '8.5in', minHeight: '11in' }}>
      <PackingSlipLayout packingSlip={packingSlip} />
    </div>
  );
}