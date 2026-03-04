const DEFAULT_API_BASE = 'http://localhost:3001';

function normalizeBaseUrl(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
        return DEFAULT_API_BASE;
    }

    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function resolveApiBaseUrl(): string {
    return normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_BASE);
}

function deriveWebSocketBaseUrl(apiBase: string): string {
    if (apiBase.startsWith('https://')) {
        return `wss://${apiBase.slice('https://'.length)}`;
    }
    if (apiBase.startsWith('http://')) {
        return `ws://${apiBase.slice('http://'.length)}`;
    }
    if (apiBase.startsWith('wss://') || apiBase.startsWith('ws://')) {
        return apiBase;
    }

    return `ws://${apiBase}`;
}

const API_BASE = resolveApiBaseUrl();

export const API_WS_BASE = deriveWebSocketBaseUrl(API_BASE);

interface ApiOptions {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
}

interface ApiErrorPayload {
    error?: string;
    message?: string;
}

export interface AuthUser {
    id: string;
    email: string;
    name: string | null;
}

export interface OrganizationSummary {
    id: string;
    name: string;
    slug: string;
    role?: 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';
}

export type OrganizationRole = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';

export interface OrganizationMember {
    id: string;
    role: OrganizationRole;
    joinedAt: string;
    user: {
        id: string;
        email: string;
        name: string | null;
        createdAt?: string;
    };
}

export interface OrganizationInvite {
    id: string;
    email: string;
    role: OrganizationRole;
    expiresAt: string;
    inviteUrl: string;
}

export interface HostEnrollmentTokenResponse {
    token: string;
    command: string;
    cloudUrl: string;
    expiresAt: string;
    projectId: string;
    projectName: string;
}

export type InventoryDensity = 'SIMPLE' | 'STANDARD' | 'DETAILED';

export interface InventoryFilters {
    search: string;
    statuses: string[];
    projectIds: string[];
    hostIds: string[];
}

export interface FleetHostSummary {
    id: string;
    name: string;
    hostname: string;
    status: 'ONLINE' | 'OFFLINE';
    lastSeen: string | null;
    containerCount: number;
    ipAddress: string | null;
    agentVersion: string | null;
    cpuCount: number | null;
    memoryTotalBytes: string | number | null;
    project: {
        id: string;
        name: string;
    };
}

export interface FleetContainerSummary {
    id: string;
    name: string;
    image: string;
    state: string;
    status: string;
    restartCount: number;
    dockerCreatedAt: string | null;
    labels: Record<string, string> | null;
    ports: Record<string, unknown> | null;
    networks: unknown;
    volumes: unknown;
}

export interface FleetInventoryResponse {
    fleetTotals: {
        hostCount: number;
        containerCount: number;
    };
    hosts: FleetHostSummary[];
}

export const TELEMETRY_HISTORY_WINDOWS = ['15m', '1h', '6h', '24h'] as const;
export type TelemetryHistoryWindow = (typeof TELEMETRY_HISTORY_WINDOWS)[number];

export const TELEMETRY_SPEED_PRESETS = ['1x', '2x', '4x'] as const;
export type TelemetrySpeedPreset = (typeof TELEMETRY_SPEED_PRESETS)[number];

export const TELEMETRY_DEFAULT_TOP_N = 5;

export interface TelemetryScope {
    organizationId: string;
    projectId?: string;
    hostId?: string;
    containerId?: string;
}

export interface TelemetryRestartIndicators {
    restartingNow: number;
    containersWithRestarts: number;
}

export interface TelemetryFrameAggregate {
    containerCount: number;
    cpuUsagePercentAvg: number;
    memoryUsageBytesAvg: number;
    networkRxBytesMax: number;
    networkTxBytesMax: number;
    restartIndicators: TelemetryRestartIndicators;
}

export interface TelemetryContributor {
    containerId: string;
    dockerId: string;
    hostId: string;
    name: string;
    cpuUsagePercent: number;
    memoryUsageBytes: number;
    networkRxBytes: number;
    networkTxBytes: number;
    restartCount: number;
    state: string;
}

export interface TelemetryTrendPoint {
    timestamp: string;
    cpuUsagePercentAvg: number;
    memoryUsageBytesAvg: number;
    networkRxBytesMax: number;
    networkTxBytesMax: number;
}

export interface TelemetryHistoryResponse {
    scope: TelemetryScope;
    window: TelemetryHistoryWindow;
    lookbackStart: string;
    aggregate: TelemetryFrameAggregate;
    topContributors: TelemetryContributor[];
    trend: TelemetryTrendPoint[];
}

export interface TelemetryLiveSnapshotResponse {
    scope: TelemetryScope;
    window: TelemetryHistoryWindow;
    aggregate: TelemetryFrameAggregate;
    topContributors: TelemetryContributor[];
    generatedAt: string;
}

export interface TelemetryQueryOptions {
    organizationId: string;
    projectId?: string;
    hostId?: string;
    containerId?: string;
    window: TelemetryHistoryWindow;
    topN?: number;
}

export interface TelemetrySubscribeMessage {
    type: 'metrics.subscribe';
    organizationId: string;
    projectId?: string;
    hostId?: string;
    containerId?: string;
    topN?: number;
}

export type TelemetryControlMessage =
    | {
          type: 'metrics.control';
          action: 'pause' | 'resume';
      }
    | {
          type: 'metrics.control';
          action: 'set-speed';
          speed: TelemetrySpeedPreset;
      };

export interface TelemetrySubscribeAckMessage {
    type: 'metrics.subscribe.ack';
    scope: TelemetryScope;
    topN: number;
}

export interface TelemetrySubscribeErrorMessage {
    type: 'metrics.subscribe.error';
    error: string;
}

export interface TelemetryControlAckMessage {
    type: 'metrics.control.ack';
    paused: boolean;
    speed: TelemetrySpeedPreset;
}

export interface TelemetryControlErrorMessage {
    type: 'metrics.control.error';
    error: string;
}

export interface TelemetryMetricsFrameMessage {
    type: 'metrics';
    scope: TelemetryScope;
    aggregate: TelemetryFrameAggregate;
    topContributors: TelemetryContributor[];
    restartIndicators: TelemetryRestartIndicators;
    generatedAt: string;
}

export type TelemetryInboundMessage =
    | TelemetrySubscribeAckMessage
    | TelemetrySubscribeErrorMessage
    | TelemetryControlAckMessage
    | TelemetryControlErrorMessage
    | TelemetryMetricsFrameMessage;

const SELECTED_ORGANIZATION_KEY = 'docker-dashboard:selected-organization-id';
const INVENTORY_DENSITY_KEY = 'docker-dashboard:inventory-density';

function appendInventoryFilters(query: URLSearchParams, filters: InventoryFilters): void {
    if (filters.search.trim()) {
        query.set('search', filters.search.trim());
    }
    if (filters.statuses.length > 0) {
        query.set('statuses', filters.statuses.join(','));
    }
    if (filters.projectIds.length > 0) {
        query.set('projectIds', filters.projectIds.join(','));
    }
    if (filters.hostIds.length > 0) {
        query.set('hostIds', filters.hostIds.join(','));
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null;
}

function isTelemetryHistoryWindow(value: unknown): value is TelemetryHistoryWindow {
    return typeof value === 'string' && TELEMETRY_HISTORY_WINDOWS.includes(value as TelemetryHistoryWindow);
}

function isTelemetrySpeedPreset(value: unknown): value is TelemetrySpeedPreset {
    return typeof value === 'string' && TELEMETRY_SPEED_PRESETS.includes(value as TelemetrySpeedPreset);
}

function sanitizeTopN(topN: number | undefined): number {
    if (!Number.isFinite(topN) || topN === undefined) {
        return TELEMETRY_DEFAULT_TOP_N;
    }

    if (topN < 1) {
        return 1;
    }

    if (topN > 25) {
        return 25;
    }

    return Math.floor(topN);
}

function parseTelemetryScope(value: unknown): TelemetryScope | null {
    if (!isRecord(value)) {
        return null;
    }

    const organizationId = asString(value.organizationId);
    if (!organizationId) {
        return null;
    }

    const projectId = asString(value.projectId) ?? undefined;
    const hostId = asString(value.hostId) ?? undefined;
    const containerId = asString(value.containerId) ?? undefined;

    return {
        organizationId,
        projectId,
        hostId,
        containerId,
    };
}

function parseRestartIndicators(value: unknown): TelemetryRestartIndicators | null {
    if (!isRecord(value)) {
        return null;
    }

    const restartingNow = asNumber(value.restartingNow);
    const containersWithRestarts = asNumber(value.containersWithRestarts);
    if (restartingNow === null || containersWithRestarts === null) {
        return null;
    }

    return {
        restartingNow,
        containersWithRestarts,
    };
}

function parseAggregate(value: unknown): TelemetryFrameAggregate | null {
    if (!isRecord(value)) {
        return null;
    }

    const containerCount = asNumber(value.containerCount);
    const cpuUsagePercentAvg = asNumber(value.cpuUsagePercentAvg);
    const memoryUsageBytesAvg = asNumber(value.memoryUsageBytesAvg);
    const networkRxBytesMax = asNumber(value.networkRxBytesMax);
    const networkTxBytesMax = asNumber(value.networkTxBytesMax);
    const restartIndicators = parseRestartIndicators(value.restartIndicators);

    if (
        containerCount === null ||
        cpuUsagePercentAvg === null ||
        memoryUsageBytesAvg === null ||
        networkRxBytesMax === null ||
        networkTxBytesMax === null ||
        !restartIndicators
    ) {
        return null;
    }

    return {
        containerCount,
        cpuUsagePercentAvg,
        memoryUsageBytesAvg,
        networkRxBytesMax,
        networkTxBytesMax,
        restartIndicators,
    };
}

function parseContributor(value: unknown): TelemetryContributor | null {
    if (!isRecord(value)) {
        return null;
    }

    const containerId = asString(value.containerId);
    const dockerId = asString(value.dockerId);
    const hostId = asString(value.hostId);
    const name = asString(value.name);
    const cpuUsagePercent = asNumber(value.cpuUsagePercent);
    const memoryUsageBytes = asNumber(value.memoryUsageBytes);
    const networkRxBytes = asNumber(value.networkRxBytes);
    const networkTxBytes = asNumber(value.networkTxBytes);
    const restartCount = asNumber(value.restartCount);
    const state = asString(value.state);

    if (
        !containerId ||
        !dockerId ||
        !hostId ||
        !name ||
        cpuUsagePercent === null ||
        memoryUsageBytes === null ||
        networkRxBytes === null ||
        networkTxBytes === null ||
        restartCount === null ||
        !state
    ) {
        return null;
    }

    return {
        containerId,
        dockerId,
        hostId,
        name,
        cpuUsagePercent,
        memoryUsageBytes,
        networkRxBytes,
        networkTxBytes,
        restartCount,
        state,
    };
}

function parseTrendPoint(value: unknown): TelemetryTrendPoint | null {
    if (!isRecord(value)) {
        return null;
    }

    const timestamp = asString(value.timestamp);
    const cpuUsagePercentAvg = asNumber(value.cpuUsagePercentAvg);
    const memoryUsageBytesAvg = asNumber(value.memoryUsageBytesAvg);
    const networkRxBytesMax = asNumber(value.networkRxBytesMax);
    const networkTxBytesMax = asNumber(value.networkTxBytesMax);

    if (
        !timestamp ||
        cpuUsagePercentAvg === null ||
        memoryUsageBytesAvg === null ||
        networkRxBytesMax === null ||
        networkTxBytesMax === null
    ) {
        return null;
    }

    return {
        timestamp,
        cpuUsagePercentAvg,
        memoryUsageBytesAvg,
        networkRxBytesMax,
        networkTxBytesMax,
    };
}

function parseContributors(value: unknown): TelemetryContributor[] | null {
    if (!Array.isArray(value)) {
        return null;
    }

    const parsed = value.map(parseContributor);
    if (parsed.some((item) => item === null)) {
        return null;
    }

    return parsed as TelemetryContributor[];
}

function parseTrend(value: unknown): TelemetryTrendPoint[] | null {
    if (!Array.isArray(value)) {
        return null;
    }

    const parsed = value.map(parseTrendPoint);
    if (parsed.some((item) => item === null)) {
        return null;
    }

    return parsed as TelemetryTrendPoint[];
}

function buildTelemetryQuery(options: TelemetryQueryOptions): string {
    const query = new URLSearchParams({
        organizationId: options.organizationId,
        window: options.window,
        topN: String(sanitizeTopN(options.topN)),
    });

    if (options.projectId) {
        query.set('projectId', options.projectId);
    }
    if (options.hostId) {
        query.set('hostId', options.hostId);
    }
    if (options.containerId) {
        query.set('containerId', options.containerId);
    }

    return query.toString();
}

function parseTelemetryInboundMessage(payload: unknown): TelemetryInboundMessage | null {
    if (!isRecord(payload)) {
        return null;
    }

    const type = asString(payload.type);
    if (!type) {
        return null;
    }

    if (type === 'metrics.subscribe.ack') {
        const scope = parseTelemetryScope(payload.scope);
        const topN = asNumber(payload.topN);
        if (!scope || topN === null) {
            return null;
        }
        return {
            type,
            scope,
            topN,
        };
    }

    if (type === 'metrics.subscribe.error' || type === 'metrics.control.error') {
        const error = asString(payload.error);
        if (!error) {
            return null;
        }
        return {
            type,
            error,
        };
    }

    if (type === 'metrics.control.ack') {
        const paused = asBoolean(payload.paused);
        const speed = payload.speed;
        if (paused === null || !isTelemetrySpeedPreset(speed)) {
            return null;
        }
        return {
            type,
            paused,
            speed,
        };
    }

    if (type === 'metrics') {
        const scope = parseTelemetryScope(payload.scope);
        const aggregate = parseAggregate(payload.aggregate);
        const topContributors = parseContributors(payload.topContributors);
        const restartIndicators = parseRestartIndicators(payload.restartIndicators);
        const generatedAt = asString(payload.generatedAt);
        if (!scope || !aggregate || !topContributors || !restartIndicators || !generatedAt) {
            return null;
        }

        return {
            type,
            scope,
            aggregate,
            topContributors,
            restartIndicators,
            generatedAt,
        };
    }

    return null;
}

async function extractErrorMessage(res: Response): Promise<string> {
    const fallback = res.status === 401 ? 'Invalid credentials' : `HTTP ${res.status}`;
    const payload = await res.json().catch(() => null) as ApiErrorPayload | null;
    return payload?.error ?? payload?.message ?? fallback;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;

    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        throw new Error(await extractErrorMessage(res));
    }

    return res.json();
}

export async function fetchCurrentUser(): Promise<AuthUser> {
    const response = await apiFetch<{ user: AuthUser }>('/auth/me');
    return response.user;
}

export async function logout(): Promise<void> {
    await apiFetch('/auth/logout', { method: 'POST' });
}

export async function fetchOrganizations(): Promise<OrganizationSummary[]> {
    const response = await apiFetch<{ organizations: OrganizationSummary[] }>('/organizations');
    return response.organizations;
}

export async function createOrganization(name: string, slug?: string): Promise<OrganizationSummary> {
    const response = await apiFetch<{ organization: OrganizationSummary }>('/organizations', {
        method: 'POST',
        body: { name, ...(slug ? { slug } : {}) },
    });
    return response.organization;
}

export async function fetchOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
    const response = await apiFetch<{ members: OrganizationMember[] }>(`/api/organizations/${organizationId}/members`);
    return response.members;
}

export async function createOrganizationInvite(
    organizationId: string,
    email: string,
    role: OrganizationRole
): Promise<OrganizationInvite> {
    const response = await apiFetch<{ invite: OrganizationInvite }>(`/api/organizations/${organizationId}/invite`, {
        method: 'POST',
        body: { email, role },
    });
    return response.invite;
}

export async function updateOrganizationMemberRole(
    organizationId: string,
    memberId: string,
    role: OrganizationRole
): Promise<OrganizationMember> {
    const response = await apiFetch<{ member: OrganizationMember }>(
        `/api/organizations/${organizationId}/members/${memberId}`,
        {
            method: 'PATCH',
            body: { role },
        }
    );
    return response.member;
}

export async function removeOrganizationMember(organizationId: string, memberId: string): Promise<void> {
    await apiFetch(`/api/organizations/${organizationId}/members/${memberId}`, {
        method: 'DELETE',
    });
}

export async function issueHostEnrollmentToken(
    organizationId: string,
    projectId: string
): Promise<HostEnrollmentTokenResponse> {
    return apiFetch<HostEnrollmentTokenResponse>('/api/hosts/tokens', {
        method: 'POST',
        body: { organizationId, projectId },
    });
}

export async function fetchFleetInventory(
    organizationId: string,
    filters: InventoryFilters
): Promise<FleetInventoryResponse> {
    const query = new URLSearchParams({ organizationId });

    if (filters.projectIds.length === 1) {
        query.set('projectId', filters.projectIds[0]);
    }

    return apiFetch<FleetInventoryResponse>(`/api/hosts?${query.toString()}`);
}

export async function fetchHostContainers(
    hostId: string,
    organizationId: string,
    filters: InventoryFilters
): Promise<FleetContainerSummary[]> {
    const query = new URLSearchParams({ organizationId });
    appendInventoryFilters(query, filters);
    const response = await apiFetch<{ containers: FleetContainerSummary[] }>(
        `/api/hosts/${hostId}/containers?${query.toString()}`
    );

    return response.containers;
}

export async function fetchTelemetryHistory(options: TelemetryQueryOptions): Promise<TelemetryHistoryResponse> {
    return apiFetch<TelemetryHistoryResponse>(`/api/metrics?${buildTelemetryQuery(options)}`);
}

export async function fetchLiveTelemetrySnapshot(options: TelemetryQueryOptions): Promise<TelemetryLiveSnapshotResponse> {
    return apiFetch<TelemetryLiveSnapshotResponse>(`/api/metrics/live?${buildTelemetryQuery(options)}`);
}

export function createTelemetrySocket(): WebSocket {
    if (typeof window === 'undefined') {
        throw new Error('Telemetry socket is only available in the browser');
    }

    return new WebSocket(`${API_WS_BASE}/ws/client`);
}

export function buildTelemetrySubscribeMessage(options: TelemetryQueryOptions): TelemetrySubscribeMessage {
    return {
        type: 'metrics.subscribe',
        organizationId: options.organizationId,
        projectId: options.projectId,
        hostId: options.hostId,
        containerId: options.containerId,
        topN: sanitizeTopN(options.topN),
    };
}

export function buildTelemetryControlMessage(action: 'pause' | 'resume'): TelemetryControlMessage;
export function buildTelemetryControlMessage(action: 'set-speed', speed: TelemetrySpeedPreset): TelemetryControlMessage;
export function buildTelemetryControlMessage(
    action: 'pause' | 'resume' | 'set-speed',
    speed?: TelemetrySpeedPreset
): TelemetryControlMessage {
    if (action === 'set-speed') {
        if (!speed || !isTelemetrySpeedPreset(speed)) {
            throw new Error('Telemetry speed preset must be one of 1x, 2x, or 4x');
        }
        return {
            type: 'metrics.control',
            action,
            speed,
        };
    }

    return {
        type: 'metrics.control',
        action,
    };
}

export function parseTelemetrySocketMessage(rawMessage: string): TelemetryInboundMessage | null {
    let payload: unknown;
    try {
        payload = JSON.parse(rawMessage) as unknown;
    } catch {
        return null;
    }

    return parseTelemetryInboundMessage(payload);
}

export function getInventoryDensityPreference(): InventoryDensity {
    if (typeof window === 'undefined') {
        return 'DETAILED';
    }

    const value = window.localStorage.getItem(INVENTORY_DENSITY_KEY);
    if (value === 'SIMPLE' || value === 'STANDARD' || value === 'DETAILED') {
        return value;
    }

    return 'DETAILED';
}

export function setInventoryDensityPreference(value: InventoryDensity): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(INVENTORY_DENSITY_KEY, value);
}

export function getSelectedOrganizationId(): string | null {
    if (typeof window === 'undefined') {
        return null;
    }
    return window.localStorage.getItem(SELECTED_ORGANIZATION_KEY);
}

export function setSelectedOrganizationId(organizationId: string): void {
    if (typeof window === 'undefined') {
        return;
    }
    window.localStorage.setItem(SELECTED_ORGANIZATION_KEY, organizationId);
}

export function clearSelectedOrganizationId(): void {
    if (typeof window === 'undefined') {
        return;
    }
    window.localStorage.removeItem(SELECTED_ORGANIZATION_KEY);
}
