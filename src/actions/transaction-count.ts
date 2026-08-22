import streamDeck, {
	action,
	DidReceiveSettingsEvent,
	KeyAction,
	KeyDownEvent,
	SingletonAction,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";

const TRANSACTION_COUNT_URL = "https://ethdeck.web3.center/api/v1/transaction-count";
const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

type TransactionPeriod = "1h" | "1d" | "7d" | "30d";

type TransactionCountSettings = {
	period?: TransactionPeriod;
};

type TransactionCountResponse = {
	chain_id: number;
	last_1h: number;
	last_1d: number;
	last_7d: number;
	last_30d: number;
	source: string;
};

/** Displays the Ethereum transaction count for the configured period. */
@action({ UUID: "com.florian-seffert.ethereum-deck.transaction-count" })
export class TransactionCount extends SingletonAction<TransactionCountSettings> {
	private readonly refreshTimers = new Map<string, NodeJS.Timeout>();
	private readonly periods = new Map<string, TransactionPeriod>();
	private cachedCount?: TransactionCountResponse;
	private cachedAt = 0;
	private countRequest?: Promise<TransactionCountResponse>;

	override async onWillAppear(ev: WillAppearEvent<TransactionCountSettings>): Promise<void> {
		if (!ev.action.isKey()) {
			return;
		}

		const period = ev.payload.settings.period ?? "1h";
		this.periods.set(ev.action.id, period);

		if (!ev.payload.settings.period) {
			await ev.action.setSettings({ ...ev.payload.settings, period: "1h" });
		}

		await this.refresh(ev.action, period);
		this.startRefreshTimer(ev.action);
	}

	override onWillDisappear(ev: WillDisappearEvent<TransactionCountSettings>): void {
		this.stopRefreshTimer(ev.action.id);
		this.periods.delete(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<TransactionCountSettings>): Promise<void> {
		if (!ev.action.isKey()) {
			return;
		}

		const period = ev.payload.settings.period ?? "1h";
		const previousPeriod = this.periods.get(ev.action.id);
		this.periods.set(ev.action.id, period);

		if (period !== previousPeriod) {
			await this.refresh(ev.action, period);
		}
	}

	override async onKeyDown(ev: KeyDownEvent<TransactionCountSettings>): Promise<void> {
		await this.refresh(ev.action, this.periods.get(ev.action.id) ?? "1h");
	}

	private startRefreshTimer(action: KeyAction<TransactionCountSettings>): void {
		this.stopRefreshTimer(action.id);
		const timer = setInterval(
			() => void this.refresh(action, this.periods.get(action.id) ?? "1h"),
			REFRESH_INTERVAL_MS,
		);
		this.refreshTimers.set(action.id, timer);
	}

	private stopRefreshTimer(actionId: string): void {
		const timer = this.refreshTimers.get(actionId);
		if (timer) {
			clearInterval(timer);
			this.refreshTimers.delete(actionId);
		}
	}

	private async refresh(action: KeyAction<TransactionCountSettings>, period: TransactionPeriod): Promise<void> {
		try {
			const count = await this.getCount();
			const values: Record<TransactionPeriod, number> = {
				"1h": count.last_1h,
				"1d": count.last_1d,
				"7d": count.last_7d,
				"30d": count.last_30d,
			};
			const value = Number(values[period]);

			if (!Number.isFinite(value)) {
				throw new Error(`Transaction count API returned an invalid ${period} value`);
			}

			await action.setTitle(`\n\n\n${new Intl.NumberFormat("en-US").format(value)}`);
		} catch (error) {
			streamDeck.logger.warn(
				"Unable to refresh the transaction count; keeping the last displayed value.",
				error,
			);
			await action.showAlert();
		}
	}

	private async getCount(): Promise<TransactionCountResponse> {
		if (this.cachedCount && Date.now() - this.cachedAt < REFRESH_INTERVAL_MS) {
			return this.cachedCount;
		}

		if (!this.countRequest) {
			this.countRequest = this.fetchCount().finally(() => {
				this.countRequest = undefined;
			});
		}

		return this.countRequest;
	}

	private async fetchCount(): Promise<TransactionCountResponse> {
		const response = await fetch(TRANSACTION_COUNT_URL);
		if (!response.ok) {
			throw new Error(`Transaction count API returned HTTP ${response.status}`);
		}

		const count = (await response.json()) as TransactionCountResponse;
		this.cachedCount = count;
		this.cachedAt = Date.now();
		return count;
	}
}
