// Georgia Baptist specific data types

export interface GeorgiaBaptistUPSRow {
  COMPANY: string;
  FULLNAME: string;
  DELADDR: string;
  ALTRNT2ADD: string;
  ALTADDR: string;
  CITY: string;
  STATE: string;
  ZIPCODE: string;
  ACCOUNT: string;
  WEIGHT: string;
  PKG: string;
  SERVICE: string;
  LENGTH: string;
  WIDTH: string;
  HEIGHT: string;
  RCOMPANY: string;
  RADDRESS: string;
  RCITY: string;
  RSTATE: string;
  RZIP: string;
  BCOMPANY: string;
  BADDRESS: string;
  BCITY: string;
  BSTATE: string;
  BZIP: string;
  RFRNC1: string;
  RFRNC2: string;
  PostersEng: string;
  PostersSPA: string;
  Inserts: string;
  GuidesENG: string;
  GuidesSPA: string;
  Envelopes: string;
  Card: string;
  Seq: string;
  RESIDENTAL: string;
  SEQOrg: string;
}

export interface GeorgiaBaptistPOBOXRow {
  FULLNAME: string;
  COMPANY: string;
  ALTADDR: string;
  DELADDR: string;
  CITY: string;
  STATE: string;
  ZIPCODE: string;
  URBANNAME: string;
  DP: string;
  CHKDGT: string;
  CRRT: string;
  RC: string;
  RT: string;
  FN: string;
  DPV: string;
  SEQ: string;
  ALTRNT2ADD: string;
  BSNSSRSDNT: string;
  DSF2RSDNTL: string;
  RDI: string;
  RESIDENTAL: string;
  ZIP: string;
  ZONE: string;
  CMTCHFLG: string;
  CMVDT: string;
  CMVTYP: string;
  LCSLNKRTRN: string;
  NCLNKRTRNC: string;
  STLNKRTRNC: string;
  DPV_CMRA: string;
  DPVNSTT: string;
  DPV_VACANT: string;
  PostersEng: string;
  PostersSPA: string;
  Inserts: string;
  GuidesENG: string;
  GuidesSPA: string;
  Envelopes: string;
  Card: string;
}

export type GeorgiaBaptistFileType = 'ups' | 'pobox' | 'unknown';

export interface GeorgiaBaptistProductCategories {
  'posters-eng': number;
  'posters-spa': number;
  'inserts': number;
  'guides-eng': number;
  'guides-spa': number;
  'envelopes': number;
  'cards': number;
}