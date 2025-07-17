import { Company } from '../types/packingSlip';

interface CompanyHeaderProps {
  company: Company;
}

export default function CompanyHeader({ company }: CompanyHeaderProps) {
  return (
    <header className="mb-8 border-b-2 border-gray-400 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black">{company.name}</h1>
          <div className="mt-2 text-sm text-gray-800">
            <p>{company.address.street}</p>
            <p>{company.address.city}, {company.address.state} {company.address.zipCode}</p>
            <p>{company.address.country}</p>
          </div>
        </div>
        <div className="text-right text-sm text-gray-800">
          <p>Phone: {company.phone}</p>
          <p>Email: {company.email}</p>
        </div>
      </div>
    </header>
  );
}