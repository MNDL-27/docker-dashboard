import { prisma } from '../lib/prisma';

export interface ContainerPayload {
    dockerId: string;
    name: string;
    image: string;
    imageId: string;
    command: string;
    state: string;
    status: string;
    restartCount?: number;
    ports: any; // Ideally typed, but JSON works
    labels: any;
    networks?: any;
    volumes?: any;
    createdAt?: string | null;
    startedAt?: string | null;
}

export interface HostSnapshotPayload {
    ipAddress?: string;
    agentVersion?: string;
    cpuCount?: number;
    memoryTotalBytes?: number;
}

export async function syncContainers(
    hostId: string,
    containers: ContainerPayload[],
    hostSnapshot?: HostSnapshotPayload
): Promise<{ added: number; updated: number; removed: number }> {
    // Use a transaction since we are deleting and upserting
    return await prisma.$transaction(async (tx) => {
        if (hostSnapshot) {
            await tx.host.update({
                where: { id: hostId },
                data: {
                    ipAddress: hostSnapshot.ipAddress || null,
                    agentVersion: hostSnapshot.agentVersion || null,
                    cpuCount: typeof hostSnapshot.cpuCount === 'number' ? hostSnapshot.cpuCount : null,
                    memoryTotalBytes:
                        typeof hostSnapshot.memoryTotalBytes === 'number' ? BigInt(hostSnapshot.memoryTotalBytes) : null,
                },
                select: { id: true },
            });
        }

        // 1. Get existing containers for this host
        const existingContainers = await tx.container.findMany({
            where: { hostId },
            select: { id: true, dockerId: true },
        });

        const existingDockerIds = new Set(existingContainers.map((c) => c.dockerId));
        const incomingDockerIds = new Set(containers.map((c) => c.dockerId));

        // 2. Find containers that no longer exist and remove them
        const toRemove = existingContainers.filter((c) => !incomingDockerIds.has(c.dockerId));

        if (toRemove.length > 0) {
            await tx.container.deleteMany({
                where: {
                    id: { in: toRemove.map((c) => c.id) },
                },
            });
        }

        let added = 0;
        let updated = 0;

        // 3. Upsert incoming containers
        for (const incoming of containers) {
            const dockerCreatedAtDate = incoming.createdAt ? new Date(incoming.createdAt) : null;
            const startedAtDate = incoming.startedAt ? new Date(incoming.startedAt) : null;

            if (existingDockerIds.has(incoming.dockerId)) {
                // Update
                await tx.container.update({
                    where: {
                        hostId_dockerId: {
                            hostId,
                            dockerId: incoming.dockerId,
                        },
                    },
                    data: {
                        name: incoming.name,
                        image: incoming.image,
                        imageId: incoming.imageId,
                        command: incoming.command,
                        state: incoming.state,
                        status: incoming.status,
                        restartCount: incoming.restartCount ?? 0,
                        ports: incoming.ports || {},
                        labels: incoming.labels || {},
                        networks: incoming.networks || {},
                        volumes: incoming.volumes || [],
                        dockerCreatedAt: dockerCreatedAtDate,
                        startedAt: startedAtDate,
                    },
                });
                updated++;
            } else {
                // Create
                await tx.container.create({
                    data: {
                        hostId,
                        dockerId: incoming.dockerId,
                        name: incoming.name,
                        image: incoming.image,
                        imageId: incoming.imageId,
                        command: incoming.command,
                        state: incoming.state,
                        status: incoming.status,
                        restartCount: incoming.restartCount ?? 0,
                        ports: incoming.ports || {},
                        labels: incoming.labels || {},
                        networks: incoming.networks || {},
                        volumes: incoming.volumes || [],
                        dockerCreatedAt: dockerCreatedAtDate,
                        startedAt: startedAtDate,
                    },
                });
                added++;
            }
        }

        return {
            added,
            updated,
            removed: toRemove.length,
        };
    });
}
