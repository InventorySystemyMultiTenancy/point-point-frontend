import React from "react";

interface InstallmentOption {
  installments: number;
  installment_amount: number;
  total_amount: number;
  recommended_message: string;
}

interface Props {
  options: InstallmentOption[];
  selected: number;
  onSelect: (installments: number) => void;
}

const MercadoPagoInstallments: React.FC<Props> = ({ options, selected, onSelect }) => {
  return (
    <div className="space-y-2">
      <label className="block font-bold mb-1">Parcelamento</label>
      <select
        className="w-full p-2 border rounded"
        value={selected}
        onChange={e => onSelect(Number(e.target.value))}
      >
        {options.map(opt => (
          <option key={opt.installments} value={opt.installments}>
            {opt.recommended_message}
          </option>
        ))}
      </select>
    </div>
  );
};

export default MercadoPagoInstallments;
