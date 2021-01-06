const express = require( 'express' );
const _ = require('lodash');
const Papa = require('papaparse');
const pug = require( 'pug' );

const auth = require( '@core/authentication' );
const { Exports } = require( '@core/database' );
const { hasSchema } = require( '@core/middleware' );
const { loadParams, parseParams, wrapAsync } = require( '@core/utils' );

const { createSchema, updateSchema } = require('./schemas.json');

const exportTypes = require('./exports');

const viewsPath = __dirname + '/views';

const exportTypeViews = {
	'active-members': pug.compileFile(viewsPath + '/tables/members.pug'),
	'edition': pug.compileFile(viewsPath + '/tables/members.pug'),
	'join-reasons': pug.compileFile(viewsPath + '/tables/join-reasons.pug')
};

const app = express();
var app_config = {};

app.set( 'views', viewsPath );

app.use( auth.isAdmin );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	res.locals.breadcrumb.push( {
		name: app_config.title,
		url: app.mountpath
	} );
	next();
} );


app.get( '/', wrapAsync( async function( req, res ) {
	const exports = await Exports.find();

	const exportsByType = Object.keys(exportTypes).map(type => ({
		name: exportTypes[type].name,
		exports: exports.filter(e => e.type === type)
	}));

	const exportTypesWithParams = await loadParams(_.map(exportTypes, (exportType, type) => ({
		...exportType, type
	})));

	res.render('index', {exportsByType, exportTypesWithParams});
} ) );

app.post( '/', hasSchema(createSchema).orFlash, wrapAsync( async function( req, res ) {
	const { body: { type, description, params } } = req;

	const exportDetails = await Exports.create({
		type, description,
		params: await parseParams(exportTypes[type], params)
	});

	req.flash('success', 'exports-created');
	res.redirect('/tools/exports/' + exportDetails._id);
} ) );

app.get( '/:uuid', wrapAsync( async function( req, res ) {
	const exportDetails = await Exports.findById(req.params.uuid);
	const exportType = exportTypes[exportDetails.type];

	const newItems = await exportType.collection.find({
		...await exportType.getQuery(exportDetails),
		exports: {$not: {$elemMatch: {
			export_id: exportDetails
		}}}
	});

	const exportItems = await exportType.collection.find({
		exports: {$elemMatch: {
			export_id: exportDetails
		}}
	});

	exportItems.forEach(item => {
		item.currentExport = item.exports.find(e => e.export_id.equals(exportDetails._id));
	});

	const exportItemsByStatus = exportType.statuses.map(status => ({
		name: status,
		items: exportItems.filter(item => item.currentExport.status === status)
	}));

	const renderItemsFn = exportTypeViews[exportDetails.type] || (() => {});

	res.render('export', {
		exportDetails,
		exportType,
		exportItems,
		exportItemsByStatus,
		newItems,
		renderItems: items => renderItemsFn({items})
	});
} ) );

app.post( '/:uuid', hasSchema(updateSchema).orFlash, wrapAsync( async function( req, res ) {
	const data = req.body;

	const exportDetails = await Exports.findById(req.params.uuid);
	const exportType = exportTypes[exportDetails.type];

	if (data.action === 'add') {
		await exportType.collection.updateMany({
			...await exportType.getQuery(exportDetails),
			exports: {$not: {$elemMatch: {
				export_id: exportDetails
			}}}
		}, {
			$push: {
				exports: {
					export_id: exportDetails,
					status: exportType.statuses[0]
				}
			}
		});

		req.flash('success', 'exports-added');
		res.redirect('/tools/exports/' + exportDetails._id);

	} else if (data.action === 'update') {
		await exportType.collection.updateMany({
			exports: {$elemMatch: {
				export_id: exportDetails,
				status: data.old_status
			}}
		},
		{
			$set: {
				'exports.$.status': data.status
			}
		});

		req.flash('success', 'exports-updated');
		res.redirect('/tools/exports/' + exportDetails._id);

	} else if (data.action === 'export') {
		const items = await exportType.collection.find({
			exports: {$elemMatch: {
				export_id: exportDetails,
				...data.status && {status: data.status}
			}}
		});

		const exportName = `export-${exportDetails.description}_${new Date().toISOString()}.csv`;
		const exportData = await exportType.getExport(items, exportDetails);
		res.attachment(exportName).send(Papa.unparse(exportData));
	} else if (data.action === 'delete') {
		await Exports.deleteOne({_id: exportDetails._id});
		await exportType.collection.updateMany({}, {
			$pull: {exports: {export_id: exportDetails._id}}
		});
		req.flash('success', 'exports-deleted');
		res.redirect('/tools/exports');
	}
} ) );

module.exports = function( config ) {
	app_config = config;
	return app;
};