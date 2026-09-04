export async function onRequestGet({ params, env }) {
    const project = await env.DB.prepare(
        'SELECT floorplan_data, floorplan_mime FROM projects WHERE id=?'
    ).bind(params.id).first();

    if (!project?.floorplan_data) {
        return new Response('Not found', { status: 404 });
    }

    const binary = atob(project.floorplan_data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    return new Response(bytes, {
        headers: {
            'Content-Type': project.floorplan_mime || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400',
        },
    });
}
