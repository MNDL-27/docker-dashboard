import { prisma } from '../lib/prisma';

export interface ContainerPayload {
    dockerId: string;
    name: string;
    image: string;
    imageId: string;
    command: string;
    state: string;
    status: string;
    ports: any; // Ideally typed, but JSON works
    labels: any;
    startedAt?: string | null;
}

export async function syncContainers(hostId: string, containers: ContainerPayload[]): Promise<{ added: number; updated: number; removed: number }> {
    // Use a transaction since we are deleting and upserting
    return await prisma.$transaction(async (tx) => {
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
                        ports: incoming.ports || {},
                        labels: incoming.labels || {},
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
                        ports: incoming.ports || {},
                        labels: incoming.labels || {},
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
