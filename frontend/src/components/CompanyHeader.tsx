import { Company } from '../types/packingSlip';

interface CompanyHeaderProps {
  company: Company;
}

export default function CompanyHeader({ company }: CompanyHeaderProps) {
  return (
    <header className="mb-8 border-b-2 border-gray-200 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{company.name}</h1>
          <div className="mt-2 text-sm text-gray-600">
            <p>{company.address.street}</p>
            <p>{company.address.city}, {company.address.state} {company.address.zipCode}</p>
            <p>{company.address.country}</p>
          </div>
        </div>
        <div className="text-right text-sm text-gray-600">
          <p>Phone: {company.phone}</p>
          <p>Email: {company.email}</p>
          <p>Web: {company.website}</p>
        </div>
      </div>
    </header>
  );
}