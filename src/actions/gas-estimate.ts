import streamDeck, {
	action,
	DidReceiveSettingsEvent,
	KeyAction,
	KeyDownEvent,
	SingletonAction,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";

const GAS_ESTIMATE_URL = "http://ethdeck.dekanhort.internal/api/v1/gas-estimate";
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

type GasPrice = "safe" | "proposed" | "fast";

type GasEstimateSettings = {
	gasPrice?: GasPrice;
};

type GasEstimateResponse = {
	chain_id: number;
	last_block: number;
	safe_gas_price_gwei: string;
	proposed_gas_price_gwei: string;
	fast_gas_price_gwei: string;
	suggested_base_fee_gwei: string;
	gas_used_ratios: string[];
	source: string;
};

/** Displays the current Ethereum gas price for the configured speed. */
@action({ UUID: "com.florian-seffert.ethereum-deck.gas-estimate" })
export class GasEstimate extends SingletonAction<GasEstimateSettings> {
	private readonly refreshTimers = new Map<string, NodeJS.Timeout>();
	private readonly gasPrices = new Map<string, GasPrice>();
	private cachedEstimate?: GasEstimateResponse;
	private lastRequestAt = 0;
	private estimateRequest?: Promise<GasEstimateResponse>;

	override async onWillAppear(ev: WillAppearEvent<GasEstimateSettings>): Promise<void> {
		if (!ev.action.isKey()) {
			return;
		}

		const gasPrice = ev.payload.settings.gasPrice ?? "proposed";
		this.gasPrices.set(ev.action.id, gasPrice);

		if (!ev.payload.settings.gasPrice) {
			await ev.action.setSettings({ ...ev.payload.settings, gasPrice: "proposed" });
		}

		await this.refresh(ev.action, gasPrice);
		this.startRefreshTimer(ev.action);
	}

	override onWillDisappear(ev: WillDisappearEvent<GasEstimateSettings>): void {
		this.stopRefreshTimer(ev.action.id);
		this.gasPrices.delete(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<GasEstimateSettings>): Promise<void> {
		if (!ev.action.isKey()) {
			return;
		}

		const gasPrice = ev.payload.settings.gasPrice ?? "proposed";
		const previousGasPrice = this.gasPrices.get(ev.action.id);
		this.gasPrices.set(ev.action.id, gasPrice);

		if (gasPrice !== previousGasPrice) {
			await this.refresh(ev.action, gasPrice);
		}
	}

	override async onKeyDown(ev: KeyDownEvent<GasEstimateSettings>): Promise<void> {
		await this.refresh(ev.action, this.gasPrices.get(ev.action.id) ?? "proposed");
	}

	private startRefreshTimer(action: KeyAction<GasEstimateSettings>): void {
		this.stopRefreshTimer(action.id);
		const timer = setInterval(
			() => void this.refresh(action, this.gasPrices.get(action.id) ?? "proposed"),
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

	private async refresh(action: KeyAction<GasEstimateSettings>, gasPrice: GasPrice): Promise<void> {
		try {
			const estimate = await this.getEstimate();
			const values: Record<GasPrice, string> = {
				safe: estimate.safe_gas_price_gwei,
				proposed: estimate.proposed_gas_price_gwei,
				fast: estimate.fast_gas_price_gwei,
			};
			const numericValue = Number(values[gasPrice]);

			if (!Number.isFinite(numericValue)) {
				throw new Error(`Gas estimate API returned an invalid ${gasPrice} gas price`);
			}

			await action.setTitle(`\n\n\n${numericValue.toFixed(2)}\ngwei`);
		} catch (error) {
			streamDeck.logger.warn("Unable to refresh the gas estimate; keeping the last displayed value.", error);
			await action.showAlert();
		}
	}

	private async getEstimate(): Promise<GasEstimateResponse> {
		const now = Date.now();

		if (this.cachedEstimate && now - this.lastRequestAt < REFRESH_INTERVAL_MS) {
			return this.cachedEstimate;
		}

		if (this.estimateRequest) {
			return this.estimateRequest;
		}

		if (now - this.lastRequestAt < REFRESH_INTERVAL_MS) {
			throw new Error("Gas estimate refresh is in its five-minute cooldown");
		}

		// Record the attempt before starting fetch so concurrent callers and failed
		// requests are both covered by the five-minute API throttle.
		this.lastRequestAt = now;
		this.estimateRequest = this.fetchEstimate().finally(() => {
			this.estimateRequest = undefined;
		});

		return this.estimateRequest;
	}

	private async fetchEstimate(): Promise<GasEstimateResponse> {
		const response = await fetch(GAS_ESTIMATE_URL);
		if (!response.ok) {
			throw new Error(`Gas estimate API returned HTTP ${response.status}`);
		}

		const estimate = (await response.json()) as GasEstimateResponse;
		this.cachedEstimate = estimate;
		return estimate;
	}
}
