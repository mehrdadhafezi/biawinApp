export type ID = string;

export type ISODateString = string;

export interface Timestamps {
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Amounts are always stored in Rial (IRR), as integers, to avoid float rounding issues. */
export type Rial = number;
