/* Shelf-sized sculpted figures, facing +z. All parts can join the room's static batch. */
import * as THREE from 'three';

export function createStudioFigures({ parent, box, cylinder, sphere, bar, group, material }) {
    const figures = group(parent);
    figures.name = 'studio-anime-figures';
    const shades = {
        skin: '#e6bda3', blush: '#c8877a', cream: '#eee9dc', ink: '#30333c',
        hairBrown: '#533a38', jacket: '#457e8d', jacketDark: '#305766', gold: '#c4a45b',
        robe: '#a5754e', robeDark: '#755037', hairBlue: '#495e8b', navy: '#34435b',
        hairSilver: '#d1d6d5', silverShade: '#9faeb6', pink: '#db95b0', aqua: '#a0c8cc',
        sand: '#d7c299'
    };
    const m = Object.fromEntries(Object.entries(shades).map(([key, color]) => [
        key, material(`figure-${key}`, { color, roughness: .83 })
    ]));
    const up = new THREE.Vector3(0, 1, 0);

    function mesh(parent, geometry, mat, x = 0, y = 0, z = 0) {
        const item = new THREE.Mesh(geometry, mat);
        item.position.set(x, y, z);
        item.castShadow = item.receiveShadow = true;
        parent.add(item);
        return item;
    }
    function oval(parent, size, at, mat) {
        const item = sphere(parent, 1, ...at, mat);
        item.scale.set(...size);
        return item;
    }
    function limb(parent, a, b, r0, r1, mat) {
        const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
        const direction = end.clone().sub(start);
        const item = cylinder(parent, r1, r0, direction.length(), 0, 0, 0, mat, 10);
        item.position.copy(start.add(end).multiplyScalar(.5));
        item.quaternion.setFromUnitVectors(up, direction.normalize());
        return item;
    }
    function panel(parent, points, mat, z = 0, depth = .012) {
        const shape = new THREE.Shape();
        points.forEach(([x, y], index) => index ? shape.lineTo(x, y) : shape.moveTo(x, y));
        shape.closePath();
        return mesh(parent, new THREE.ExtrudeGeometry(shape, {
            depth, bevelEnabled: false, steps: 1, curveSegments: 1
        }), mat, 0, 0, z);
    }
    // Tapered curves give locks of hair and cloth ties a sculpted silhouette.
    function strand(parent, points, radius, mat, endScale = .10) {
        const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
        const segments = Math.max(6, points.length * 3), sides = 6;
        const geometry = new THREE.TubeGeometry(curve, segments, radius, sides, false);
        const positions = geometry.attributes.position;
        for (let i = 0; i <= segments; i++) {
            const center = curve.getPointAt(i / segments);
            const scale = .88 + Math.sin(i / segments * Math.PI) * .12 - Math.pow(i / segments, 2.8) * (.88 - endScale);
            for (let j = 0; j <= sides; j++) {
                const index = i * (sides + 1) + j;
                positions.setXYZ(index,
                    center.x + (positions.getX(index) - center.x) * scale,
                    center.y + (positions.getY(index) - center.y) * scale,
                    center.z + (positions.getZ(index) - center.z) * scale);
            }
        }
        geometry.computeVertexNormals();
        return mesh(parent, geometry, mat);
    }
    function head(parent, at, hair, long = false) {
        const face = group(parent, ...at);
        oval(face, [.064, .084, .059], [0, 0, 0], m.skin);
        const cap = mesh(face, new THREE.SphereGeometry(.087, 16, 10, 0, Math.PI * 2, 0, 1.72), hair, 0, .013, -.009);
        cap.scale.set(.86, .94, .79);
        for (const side of [-1, 1]) {
            oval(face, [.012, .019, .012], [side * .061, -.015, 0], m.skin);
            oval(face, [.0075, .010, .004], [side * .025, -.007, .055], m.ink);
            oval(face, [.0024, .003, .002], [side * .023, -.003, .059], m.cream);
            bar(face, [side * .013, .007, .055], [side * .036, .009, .051], .003, hair);
            strand(face, [[side * .047, .049, .018], [side * .067, -.010, .033], [side * .062, long ? -.12 : -.070, .012]], .020, hair);
        }
        for (let i = -2; i <= 2; i++) {
            const x = i * .023;
            strand(face, [[x * .6, .076, .007], [x, .038, .051], [x * .82 + .006, .008 - (i % 2) * .014, .055]], .018, hair);
        }
        oval(face, [.009, .012, .010], [0, -.023, .058], m.skin);
        bar(face, [-.009, -.044, .052], [.009, -.045, .052], .0025, m.blush);
        return face;
    }
    function flower(parent, at, size, petals, center = m.gold) {
        const bloom = group(parent, ...at);
        for (let i = 0; i < 5; i++) {
            const angle = i * Math.PI * .4;
            const petal = oval(bloom, [size * .47, size * .75, size * .18], [Math.sin(angle) * size * .56, Math.cos(angle) * size * .56, 0], petals);
            petal.rotation.z = -angle;
        }
        oval(bloom, [size * .30, size * .30, size * .22], [0, 0, size * .14], center);
        return bloom;
    }

    // Cropped blue jacket, short brown bob, white shorts and a wide, active stance.
    const sporty = group(figures, -1.02, 0, .015);
    sporty.name = 'blue-jacket-figure';
    const sportBase = cylinder(sporty, .35, .35, .035, 0, .018, 0, m.robeDark, 32);
    sportBase.scale.z = .63;
    for (const [hip, knee, ankle, shoe] of [
        [[-.035, .48, 0], [-.135, .29, .015], [-.235, .080, .040], [-.254, .063, .077]],
        [[.063, .48, -.015], [.163, .275, -.035], [.270, .083, -.010], [.290, .063, .030]]
    ]) {
        limb(sporty, hip, knee, .042, .029, m.skin);
        oval(sporty, [.030, .032, .031], knee, m.skin);
        limb(sporty, knee, ankle, .030, .020, m.skin);
        limb(sporty, ankle, [ankle[0], ankle[1] + .065, ankle[2]], .027, .025, m.cream);
        const sneaker = box(sporty, .080, .045, .14, ...shoe, m.cream, .020);
        sneaker.rotation.y = shoe[0] < 0 ? -.26 : .38;
        box(sporty, .075, .012, .135, shoe[0], .043, shoe[2], m.silverShade, .005);
        for (let i = 0; i < 3; i++) bar(sporty, [shoe[0] - .026, .087, shoe[2] + i * .018], [shoe[0] + .026, .087, shoe[2] + i * .018], .0035, m.silverShade);
    }
    const shorts = cylinder(sporty, .095, .108, .126, .015, .488, 0, m.cream, 10);
    shorts.scale.z = .65;
    bar(sporty, [.015, .427, .069], [.015, .470, .069], .0035, m.silverShade);
    const shirt = cylinder(sporty, .082, .068, .175, 0, .627, 0, m.cream, 12);
    shirt.scale.z = .65;
    const jacket = cylinder(sporty, .114, .122, .188, -.004, .675, -.005, m.jacket, 12);
    jacket.scale.z = .65;
    panel(sporty, [[-.018, .757], [.043, .754], [.070, .585], [-.013, .589]], m.jacketDark, .069);
    panel(sporty, [[.080, .661], [.131, .674], [.233, .609], [.143, .582], [.099, .584]], m.jacket, -.022, .037);
    bar(sporty, [-.11, .591, .025], [.081, .581, .075], .009, m.gold);
    bar(sporty, [.096, .588, .061], [.201, .610, .010], .007, m.gold);
    limb(sporty, [-.09, .730, 0], [-.153, .674, .032], .052, .042, m.jacket);
    limb(sporty, [-.153, .674, .032], [-.109, .802, .105], .042, .029, m.jacket);
    oval(sporty, [.025, .031, .023], [-.101, .821, .111], m.skin);
    limb(sporty, [.102, .728, .005], [.167, .649, .055], .053, .041, m.jacket);
    limb(sporty, [.167, .649, .055], [-.010, .753, .120], .041, .026, m.jacket);
    oval(sporty, [.027, .027, .024], [-.025, .762, .122], m.skin);
    bar(sporty, [.087, .715, .061], [.125, .682, .083], .011, m.gold);
    bar(sporty, [-.108, .801, .135], [-.070, .837, .130], .014, m.ink);
    oval(sporty, [.021, .025, .021], [-.061, .845, .130], m.silverShade);
    cylinder(sporty, .028, .032, .057, -.012, .790, 0, m.skin, 12);
    const sportHead = head(sporty, [-.031, .875, .005], m.hairBrown);
    sportHead.rotation.z = .12;
    for (const side of [-1, 1]) {
        strand(sportHead, [[side * .058, .027, -.025], [side * .077, -.062, -.012], [side * .097, -.071, -.010]], .020, m.hairBrown);
    }
    strand(sporty, [[-.092, .55, .047], [-.004, .509, .082], [.131, .477, .04]], .009, m.gold);

    // Wide-brimmed pointed hat, blue braid, split ochre coat and raised forked staff.
    const mage = group(figures, 0, 0, -.015);
    mage.name = 'blue-haired-mage-figure';
    const mageBase = cylinder(mage, .33, .34, .037, 0, .019, 0, m.silverShade, 32);
    mageBase.scale.z = .72;
    const starPoints = Array.from({ length: 10 }, (_, i) => {
        const angle = i * Math.PI / 5, radius = i % 2 ? .080 : .210;
        return [Math.sin(angle) * radius, Math.cos(angle) * radius];
    });
    const star = panel(mage, starPoints, m.gold, 0, .004);
    star.rotation.x = -Math.PI / 2;
    star.position.y = .040;
    for (const side of [-1, 1]) {
        const footX = side * .117;
        limb(mage, [side * .066, .574, -.006], [side * .095, .369, .015], .038, .030, m.skin);
        limb(mage, [side * .095, .369, .015], [footX, .111, .030], .031, .022, m.cream);
        const bootTop = limb(mage, [side * .093, .390, .018], [side * .103, .290, .024], .041, .032, m.navy);
        bootTop.scale.z = .94;
        box(mage, .074, .050, .13, footX, .071, .058, m.cream, .015);
        box(mage, .039, .030, .035, footX, .052, .005, m.robeDark, .005);
        strand(mage, [[side * .084, .323, .054], [side * .093, .234, .061], [footX, .108, .064]], .006, m.gold);
    }
    const skirt = cylinder(mage, .096, .16, .163, 0, .562, -.006, m.navy, 12);
    skirt.scale.z = .64;
    const blouse = cylinder(mage, .080, .092, .246, 0, .758, -.018, m.cream, 12);
    blouse.scale.z = .67;
    panel(mage, [[-.043, .864], [.032, .864], [.073, .634], [.039, .540], [-.061, .555]], m.jacket, .052);
    bar(mage, [-.081, .654, .036], [.079, .654, .051], .010, m.navy);
    box(mage, .052, .025, .015, .003, .653, .068, m.gold, .003);
    panel(mage, [[-.070, .878], [-.145, .829], [-.177, .626], [-.328, .372], [-.173, .414], [-.088, .536], [-.108, .728]], m.robeDark, -.071, .024);
    panel(mage, [[.073, .879], [.142, .826], [.116, .645], [.236, .356], [.151, .402], [.088, .542], [.073, .732]], m.robe, -.062, .027);
    panel(mage, [[-.096, .862], [-.144, .813], [-.095, .686], [-.055, .757]], m.robe, .034);
    panel(mage, [[.068, .866], [.111, .828], [.080, .707], [.041, .754]], m.robeDark, .041);
    strand(mage, [[-.10, .852, .052], [-.062, .770, .069], [-.11, .671, .033], [-.163, .494, -.016], [-.272, .403, -.040]], .008, m.gold);
    strand(mage, [[.096, .851, .062], [.060, .766, .070], [.100, .630, .005], [.164, .436, -.025], [.219, .370, -.032]], .009, m.cream);
    panel(mage, [[-.021, .862], [.030, .862], [.011, .781], [-.007, .798]], m.navy, .073);
    oval(mage, [.014, .019, .008], [.004, .847, .085], m.aqua);
    limb(mage, [-.10, .846, -.012], [-.190, .727, .014], .044, .034, m.cream);
    limb(mage, [-.190, .727, .014], [-.228, .622, .059], .034, .021, m.navy);
    oval(mage, [.024, .032, .021], [-.231, .602, .064], m.skin);
    limb(mage, [.106, .847, -.012], [.211, .978, .010], .044, .030, m.cream);
    limb(mage, [.211, .978, .010], [.314, 1.094, .005], .031, .018, m.navy);
    oval(mage, [.027, .022, .024], [.322, 1.098, .005], m.skin);
    cylinder(mage, .027, .031, .051, 0, .903, -.015, m.skin, 12);
    const mageHead = head(mage, [0, .974, -.015], m.hairBlue, true);
    mageHead.rotation.z = -.065;
    for (let i = 0; i < 8; i++) {
        oval(mage, [.025 - i * .001, .027, .022], [-.082 - i * .015 + (i % 2) * .008, .924 - i * .042, .010 + (i % 2) * .012], m.hairBlue);
    }
    strand(mage, [[-.185, .646, .009], [-.207, .610, .030], [-.213, .567, .045]], .016, m.hairBlue);
    bar(mage, [-.204, .631, .012], [-.178, .640, .035], .008, m.gold);
    const hat = group(mage, 0, 1.057, -.020);
    hat.rotation.z = -.10;
    const brim = cylinder(hat, .255, .251, .023, 0, 0, 0, m.navy, 32);
    brim.scale.z = .79;
    const crown = cylinder(hat, .029, .128, .181, -.010, .093, -.015, m.navy, 12);
    crown.rotation.z = -.16;
    limb(hat, [-.025, .173, -.015], [.047, .222, -.006], .033, .006, m.navy);
    const hatBand = cylinder(hat, .117, .127, .030, 0, .023, -.012, m.robe, 20);
    hatBand.scale.z = .96;
    const staffA = [.229, .952, -.011], staffB = [.422, 1.262, -.012];
    bar(mage, staffA, staffB, .014, m.robeDark);
    bar(mage, [.262, 1.007, -.01], [.335, 1.123, -.01], .020, m.ink);
    for (let i = 0; i < 4; i++) {
        const ring = cylinder(mage, .022, .022, .010, .279 + i * .012, 1.034 + i * .020, -.01, m.silverShade, 10);
        ring.rotation.z = -.56;
    }
    strand(mage, [[.392, 1.213, -.012], [.357, 1.247, -.011], [.382, 1.311, -.012]], .022, m.cream, .65);
    strand(mage, [[.420, 1.258, -.012], [.467, 1.299, -.012], [.473, 1.342, -.012]], .022, m.cream, .45);
    const leftPetal = oval(mage, [.031, .053, .018], [.365, 1.315, -.012], m.silverShade);
    leftPetal.rotation.z = .68;
    const rightPetal = oval(mage, [.035, .052, .021], [.483, 1.329, -.012], m.cream);
    rightPetal.rotation.z = -.44;
    mesh(mage, new THREE.OctahedronGeometry(.024, 0), m.aqua, .409, 1.288, .007);

    // Silver-haired seated figure with layered fins, flowers, travel cases and crossed legs.
    const seated = group(figures, 1.025, 0, -.008);
    seated.name = 'silver-haired-seated-figure';
    const sandBase = cylinder(seated, .414, .421, .042, 0, .022, 0, m.sand, 32);
    sandBase.scale.z = .72;
    box(seated, .365, .238, .269, -.040, .170, -.063, m.navy, .035);
    box(seated, .384, .039, .288, -.040, .294, -.063, m.robeDark, .015);
    box(seated, .219, .129, .185, -.264, .110, .072, m.pink, .018);
    box(seated, .032, .134, .190, -.280, .112, .072, m.gold, .006);
    box(seated, .105, .140, .081, .240, .117, -.066, m.cream, .012);
    box(seated, .083, .069, .060, -.312, .082, .190, m.jacket, .008);
    bar(seated, [-.344, .119, .190], [-.344, .169, .190], .006, m.gold);
    bar(seated, [-.344, .169, .190], [-.28, .169, .190], .006, m.gold);
    bar(seated, [-.28, .169, .190], [-.28, .119, .190], .006, m.gold);
    // The back fans are actual layered geometry, with individually raised pale ribs.
    for (const side of [-1, 1]) {
        for (let i = 0; i < 5; i++) {
            const x = side * (.14 + i * .043), y = .68 - i * .065;
            const fin = panel(seated, [[side * .042, .38], [x * .91, y + .012], [x + side * .087, y + .015], [x + side * .039, y - .059]], i % 2 ? m.aqua : m.cream, -.161 - i * .006, .010);
            fin.rotation.y = side * .08;
            bar(seated, [side * .042, .38, -.148], [x + side * .070, y + .010, -.148 - i * .006], .004, m.silverShade);
        }
    }
    oval(seated, [.101, .081, .075], [-.026, .410, .005], m.skin);
    const torso = cylinder(seated, .063, .075, .222, -.049, .550, -.009, m.skin, 12);
    torso.scale.z = .70;
    torso.rotation.z = -.11;
    const bodice = cylinder(seated, .079, .065, .062, -.063, .594, -.008, m.pink, 12);
    bodice.scale.z = .74;
    panel(seated, [[-.129, .623], [-.062, .581], [-.007, .626], [-.050, .586], [-.074, .586]], m.navy, .036, .006);
    const skirtFrill = cylinder(seated, .081, .137, .061, -.026, .410, .021, m.aqua, 12);
    skirtFrill.scale.z = .67;
    for (let i = 0; i < 7; i++) {
        const angle = Math.PI * (i / 6);
        oval(seated, [.031, .021, .022], [-.026 + Math.cos(angle) * .118, .390 + (i % 2) * .008, .023 + Math.sin(angle) * .080], i % 2 ? m.cream : m.pink);
    }
    const legs = [
        [[.025, .403, .029], [.148, .292, .178], [.321, .094, .270], [.345, .071, .286]],
        [[-.067, .395, .040], [.070, .300, .226], [.161, .094, .294], [.175, .071, .305]]
    ];
    for (const [hip, knee, ankle, shoe] of legs) {
        limb(seated, hip, knee, .043, .030, m.skin);
        oval(seated, [.032, .032, .031], knee, m.skin);
        limb(seated, knee, ankle, .031, .021, m.skin);
        const sandal = oval(seated, [.042, .029, .059], shoe, m.navy);
        sandal.rotation.y = -.25;
        for (let i = 0; i < 3; i++) {
            bar(seated, [shoe[0] - .027, shoe[1] + .019, shoe[2] + .032 - i * .018], [shoe[0] + .027, shoe[1] + .024, shoe[2] + .010 - i * .018], .004, m.cream);
        }
        limb(seated, [ankle[0], ankle[1] + .017, ankle[2]], [ankle[0] + .003, ankle[1] + .029, ankle[2] - .003], .027, .027, m.navy);
    }
    limb(seated, [-.130, .638, -.015], [-.173, .502, .045], .026, .020, m.skin);
    limb(seated, [-.173, .502, .045], [-.079, .405, .092], .021, .016, m.skin);
    oval(seated, [.019, .026, .017], [-.071, .392, .104], m.skin);
    limb(seated, [.020, .638, -.019], [.114, .721, .012], .026, .020, m.skin);
    limb(seated, [.114, .721, .012], [.213, .730, .046], .020, .015, m.skin);
    oval(seated, [.021, .020, .017], [.227, .733, .048], m.skin);
    bar(seated, [.217, .725, .050], [.252, .752, .050], .006, m.skin);
    cylinder(seated, .024, .029, .051, -.081, .696, -.018, m.skin, 12);
    const silverHead = head(seated, [-.094, .774, -.020], m.hairSilver, true);
    silverHead.rotation.z = .14;
    for (const side of [-1, 1]) {
        for (let i = 0; i < 5; i++) {
            const spread = .20 + i * .036;
            strand(seated, [
                [-.095 + side * .039, .808 - i * .009, -.061 - i * .010],
                [-.088 + side * (.11 + i * .012), .661 - i * .026, -.077 - i * .020],
                [-.050 + side * spread, .460 - i * .016, -.110 - i * .016],
                [-.018 + side * (spread + .019), .287 + i * .014, -.016 - i * .017],
                [side * (spread - .016), .267 + i * .012, .004 - i * .012]
            ], .025 - i * .0017, i % 3 ? m.hairSilver : m.silverShade);
        }
    }
    // A compact top ornament and asymmetrical ribbons preserve the photo's silhouette.
    flower(seated, [-.023, .848, .012], .033, m.gold, m.robeDark);
    flower(seated, [-.149, .859, -.015], .029, m.navy, m.pink);
    flower(seated, [-.166, .446, .082], .032, m.pink);
    flower(seated, [.182, .717, .031], .024, m.pink);
    strand(seated, [[-.126, .871, -.041], [-.162, .920, -.051], [-.211, .933, -.036], [-.219, .906, -.035]], .006, m.aqua);
    strand(seated, [[-.175, .839, .028], [-.248, .752, .032], [-.209, .654, .071], [-.274, .612, .05]], .008, m.pink);
    strand(seated, [[.176, .719, .042], [.235, .674, .075], [.184, .631, .078], [.186, .496, .082]], .005, m.aqua);
    for (let i = 0; i < 4; i++) {
        strand(seated, [[-.083 + i * .023, .619, .054], [-.055 + i * .026, .486, .093], [.028 + i * .027, .303, .210]], .0025, m.cream, .7);
    }

    return figures;
}
