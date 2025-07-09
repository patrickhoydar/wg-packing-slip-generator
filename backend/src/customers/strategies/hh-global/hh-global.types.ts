export interface HHGlobalCSVRow {
  'Shipment too': string;
  'Address': string;
  'City': string;
  'State': string;
  'Zip': string;
  'Recipient Email': string;
  
  // Seed Guides - 15 state variations
  'Colorado Seed Guide 6F0425386': string;
  'Illinois Seed Guide 6F0425375': string;
  'Iowa Seed Guide 6F0425381': string;
  'Kansas Seed Guide 6F0425379': string;
  'Wisconsin Seed Guide 6F0425377': string;
  'South Dakota Seed Guide 6F0425376': string;
  'Ohio Seed Guide 6F0425382': string;
  'Minnesota Seed Guide 6F0425374': string;
  'Nebraska Seed Guide 6F0425385': string;
  'Missouri; Eastern Kansas Seed Guide 6F0425378': string;
  'North Dakota; Northern Minnesota; Montana Seed Guide 6F0425373': string;
  'Northeast Seed Guide 6F0425384': string;
  'Northern Indiana; Michigan Seed Guide 6F0425383': string;
  'Southern Indiana; Kentucky Seed Guide 6F0425380': string;
  'National Seed Guide 6F0425387': string;
  
  // One Pagers - 3 slots
  'One Pager #1': string;
  'One Pager #1 QC Number': string;
  'One Pager #2': string;
  'One Pager #2 QC Number': string;
  'One Pager #3': string;
  'One Pager #3 QC Number': string;
}

export const SEED_GUIDE_COLUMNS = [
  'Colorado Seed Guide 6F0425386',
  'Illinois Seed Guide 6F0425375',
  'Iowa Seed Guide 6F0425381',
  'Kansas Seed Guide 6F0425379',
  'Wisconsin Seed Guide 6F0425377',
  'South Dakota Seed Guide 6F0425376',
  'Ohio Seed Guide 6F0425382',
  'Minnesota Seed Guide 6F0425374',
  'Nebraska Seed Guide 6F0425385',
  'Missouri; Eastern Kansas Seed Guide 6F0425378',
  'North Dakota; Northern Minnesota; Montana Seed Guide 6F0425373',
  'Northeast Seed Guide 6F0425384',
  'Northern Indiana; Michigan Seed Guide 6F0425383',
  'Southern Indiana; Kentucky Seed Guide 6F0425380',
  'National Seed Guide 6F0425387'
] as const;

export const ONE_PAGER_COLUMNS = [
  { name: 'One Pager #1', qc: 'One Pager #1 QC Number' },
  { name: 'One Pager #2', qc: 'One Pager #2 QC Number' },
  { name: 'One Pager #3', qc: 'One Pager #3 QC Number' }
] as const;

export const REQUIRED_COLUMNS: string[] = [
  'Address',
  'City', 
  'State',
  'Zip'
];

export interface HHGlobalConfig {
  referenceNumber: string;
  carrierInfo: {
    name: string;
    account: string;
    service: string;
  };
  shippingRules: {
    smallShipmentThreshold: number; // cartons
    smallShipmentMethod: string;
    largeShipmentMethod: string;
  };
  branding: {
    companyName: string;
    shouldBlindShip: boolean;
  };
}