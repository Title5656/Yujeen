export type Currency = 'USD' | 'THB';
export type Market = 'US' | 'TH';

export interface SecurityIdentity {
  readonly securityId: string;
  readonly symbol: string;
  readonly market: Market;
}
