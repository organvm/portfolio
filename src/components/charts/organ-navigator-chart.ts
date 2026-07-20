import * as d3 from 'd3';
import { getChartTheme } from './chart-theme';
import { createTooltip } from './chart-utils';

interface OrganNode {
	organ: string;
	label: string;
	count: number;
	projects: { slug: string; title: string }[];
	color: string;
}

interface ProjectNode {
	slug: string;
	title: string;
	organ: string;
	x: number;
	y: number;
}

export default function organNavigatorChart(container: HTMLElement, data: Record<string, unknown>) {
	const organs = data.organs as OrganNode[];
	const theme = getChartTheme();
	const tooltip = createTooltip(container);

	const width = container.clientWidth - 32; // account for padding
	const height = Math.max(400, Math.min(width * 0.8, 550));
	const cx = width / 2;
	const cy = height / 2;
	const radius = Math.min(cx, cy) * 0.55;
	const projectRadius = radius * 0.35;

	const svg = d3
		.select(container)
		.append('svg')
		.attr('width', width)
		.attr('height', height)
		.attr('viewBox', `0 0 ${width} ${height}`);

	// Position organs in an octagon
	const organPositions = organs.map((organ, i) => {
		const angle = (i / organs.length) * Math.PI * 2 - Math.PI / 2;
		return {
			...organ,
			x: cx + Math.cos(angle) * radius,
			y: cy + Math.sin(angle) * radius,
			angle,
		};
	});

	// Draw connecting lines between all organs (subtle)
	const lineGroup = svg.append('g').attr('class', 'organ-lines');
	for (let i = 0; i < organPositions.length; i++) {
		const next = organPositions[(i + 1) % organPositions.length];
		lineGroup
			.append('line')
			.attr('x1', organPositions[i].x)
			.attr('y1', organPositions[i].y)
			.attr('x2', next.x)
			.attr('y2', next.y)
			.attr('stroke', theme.border)
			.attr('stroke-width', 1)
			.attr('opacity', 0.4);
	}

	// State: which organ is expanded
	let expandedOrgan: string | null = null;
	let projectNodes: d3.Selection<SVGGElement, ProjectNode, SVGGElement, unknown> | null = null;

	// Draw organ nodes
	const organGroup = svg.append('g').attr('class', 'organ-nodes');
	const nodes = organGroup
		.selectAll('g')
		.data(organPositions)
		.join('g')
		.attr('transform', (d) => `translate(${d.x}, ${d.y})`)
		.style('cursor', 'pointer');

	// Organ circles
	nodes
		.append('circle')
		.attr('r', 24)
		.attr('fill', (d) => d.color)
		.attr('opacity', 0.85)
		.attr('stroke', (d) => d.color)
		.attr('stroke-width', 2);

	// Organ count label
	nodes
		.append('text')
		.text((d) => d.count)
		.attr('text-anchor', 'middle')
		.attr('dy', '0.35em')
		.attr('font-size', '12px')
		.attr('font-weight', '700')
		.attr('fill', '#fff')
		.attr('pointer-events', 'none');

	// Organ name label
	nodes
		.append('text')
		.text((d) => d.label)
		.attr('text-anchor', 'middle')
		.attr('dy', '42px')
		.attr('font-size', '10px')
		.attr('font-weight', '500')
		.attr('fill', theme.textSecondary)
		.attr('pointer-events', 'none');

	// Center label
	svg
		.append('text')
		.text('ORGANVM')
		.attr('x', cx)
		.attr('y', cy)
		.attr('text-anchor', 'middle')
		.attr('dy', '0.35em')
		.attr('font-size', '11px')
		.attr('font-weight', '600')
		.attr('letter-spacing', '0.1em')
		.attr('fill', theme.textMuted)
		.attr('pointer-events', 'none');

	// Hover tooltip on organs
	nodes
		.on('mouseenter', (event: MouseEvent, d) => {
			tooltip.show(
				`<strong>${d.label}</strong><br/>${d.organ}<br/>${d.count} project${d.count !== 1 ? 's' : ''}`,
				event,
			);
		})
		.on('mouseleave', () => {
			tooltip.hide();
		});

	// Project expansion group
	const projectGroup = svg.append('g').attr('class', 'project-nodes');

	// Click organ → expand projects
	nodes.on('click', (_event: MouseEvent, d) => {
		tooltip.hide();

		if (expandedOrgan === d.organ) {
			// Collapse
			expandedOrgan = null;
			projectGroup.selectAll('*').remove();
			projectNodes = null;
			nodes.select('circle').transition().duration(300).attr('opacity', 0.85);
			return;
		}

		expandedOrgan = d.organ;
		projectGroup.selectAll('*').remove();

		// Dim other organs
		nodes
			.select('circle')
			.transition()
			.duration(300)
			.attr('opacity', (o: typeof d) => (o.organ === d.organ ? 1 : 0.3));

		// Position projects around the selected organ
		const projData: ProjectNode[] = d.projects.map((p, i) => {
			const pAngle = d.angle + (i - (d.projects.length - 1) / 2) * 0.3;
			return {
				...p,
				organ: d.organ,
				x: d.x + Math.cos(pAngle) * projectRadius,
				y: d.y + Math.sin(pAngle) * projectRadius,
			};
		});

		// Draw connecting lines from organ to projects
		projectGroup
			.selectAll('line')
			.data(projData)
			.join('line')
			.attr('x1', d.x)
			.attr('y1', d.y)
			.attr('x2', (p) => p.x)
			.attr('y2', (p) => p.y)
			.attr('stroke', d.color)
			.attr('stroke-width', 1)
			.attr('opacity', 0)
			.transition()
			.duration(400)
			.attr('opacity', 0.5);

		// Draw project nodes
		projectNodes = projectGroup
			.selectAll<SVGGElement, ProjectNode>('g')
			.data(projData)
			.join('g')
			.attr('transform', () => `translate(${d.x}, ${d.y})`)
			.style('cursor', 'pointer');

		projectNodes
			.append('circle')
			.attr('r', 0)
			.attr('fill', d.color)
			.attr('opacity', 0.6)
			.transition()
			.duration(400)
			.attr('r', 10);

		projectNodes
			.transition()
			.duration(400)
			.attr('transform', (p) => `translate(${p.x}, ${p.y})`);

		// Project labels
		projectNodes
			.append('text')
			.text((p) => (p.title.length > 18 ? p.title.slice(0, 16) + '...' : p.title))
			.attr('text-anchor', 'middle')
			.attr('dy', '22px')
			.attr('font-size', '8px')
			.attr('fill', theme.textMuted)
			.attr('pointer-events', 'none')
			.attr('opacity', 0)
			.transition()
			.delay(200)
			.duration(300)
			.attr('opacity', 1);

		// Click project → navigate
		projectNodes.on('click', (_event: MouseEvent, p: ProjectNode) => {
			const base =
				document.querySelector<HTMLAnchorElement>('.header__logo')?.getAttribute('href') ||
				'/portfolio/';
			window.location.href = `${base}projects/${p.slug}/`;
		});

		// Tooltip on project hover
		projectNodes
			.on('mouseenter', (event: MouseEvent, p: ProjectNode) => {
				tooltip.show(`<strong>${p.title}</strong><br/>Click to view project`, event);
			})
			.on('mouseleave', () => {
				tooltip.hide();
			});
	});
}
