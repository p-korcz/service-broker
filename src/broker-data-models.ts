type ExchangeType = 'direct' | 'topic' | 'headers' | 'fanout';
export type BrokerMessage = Record<string, unknown> | string;
export type ConnectionParams = { url: string; exchange: string; exchangeType: ExchangeType };

export interface Broker {
    params: ConnectionParams;
    reconnectAttempts: number;
    publish(message: BrokerMessage, severity: string): void;
    subscribe(cb: (msg: BrokerMessage) => void, ...severities: string[]): void;
    reconnect(onReconnect: () => Broker['publish' | 'subscribe']): void;
}
