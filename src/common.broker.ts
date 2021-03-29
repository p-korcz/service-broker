import { connect } from 'amqplib/callback_api';
import { Broker, BrokerMessage, ConnectionParams } from 'broker-data-models';

export default abstract class CommonBroker implements Broker {
    params: ConnectionParams;
    reconnectAttempts: number;
    constructor(params: ConnectionParams) {
        this.params = params;
        this.reconnectAttempts = 0;
    }
    reconnect(onReconnect: Broker['publish' | 'subscribe']): void {
        if (this.reconnectAttempts <= 5) {
            onReconnect;
            this.reconnectAttempts++;
        }
    }
    publish(message: BrokerMessage, severity: string): void {
        connect(this.params.url, (connectionError, connection) => {
            if (connectionError) {
                return this.reconnect(() => this.publish(message, severity));
            }
            connection.createChannel((channelCreateError, channel) => {
                if (channelCreateError) {
                    return this.reconnect(() => this.publish(message, severity));
                }
                channel.assertExchange(this.params.exchange, this.params.exchangeType, {
                    durable: false,
                });
                const stringifiedMessage = JSON.stringify(message);
                channel.publish(this.params.exchange, severity, Buffer.from(stringifiedMessage));
            });
            setTimeout(() => {
                connection.close();
                this.reconnectAttempts = 0;
            }, 500);
        });
    }

    subscribe(cb: (msg: BrokerMessage) => void, ...severities: string[]): void {
        connect(this.params.url, (connectionError, connection) => {
            if (connectionError) {
                return this.reconnect(() => this.subscribe(cb, ...severities));
            }
            connection.createChannel((channelCreateError, channel) => {
                if (channelCreateError) {
                    return this.reconnect(() => this.subscribe(cb, ...severities));
                }

                this.reconnectAttempts = 0;

                channel.assertExchange(this.params.exchange, this.params.exchangeType, {
                    durable: false,
                });
                channel.assertQueue(
                    '',
                    {
                        exclusive: true,
                    },
                    (assertError, q) => {
                        if (assertError) {
                            throw assertError;
                        }
                        severities.forEach((severity) => channel.bindQueue(q.queue, this.params.exchange, severity));

                        channel.consume(
                            q.queue,
                            (msg) => {
                                cb(msg!.content.toString());
                            },
                            {
                                noAck: true,
                            },
                        );
                    },
                );
            });
        });
    }
}
