import streamDeck from "@elgato/streamdeck";

import { EthPrice } from "./actions/eth-price";
import { GasEstimate } from "./actions/gas-estimate";
import { TransactionCount } from "./actions/transaction-count";

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. When storing sensitive information
streamDeck.logger.setLevel("trace");

// Register the ETH price action.
streamDeck.actions.registerAction(new EthPrice());
streamDeck.actions.registerAction(new GasEstimate());
streamDeck.actions.registerAction(new TransactionCount());

// Finally, connect to the Stream Deck.
streamDeck.connect();
