const express = require( 'express' );
const moment = require( 'moment' );

const config = require( __config );

const { GiftFlows, Members } = require( __js + '/database' );
const { hasModel, hasSchema } = require( __js + '/middleware' );
const stripe = require( __js + '/stripe' );
const { wrapAsync } = require( __js + '/utils' );
const Options = require( __js + '/options' )();

const { generateMemberCode } = require( __apps + '/join/utils' );

const { createGiftSchema } = require( './schema.json' );

const app = express();
var app_config = {};

app.set( 'views', __dirname + '/views' );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	res.locals.activeApp = app_config.uid;
	next();
} );

app.get( '/', ( req, res ) => {
	res.render( 'index', { stripePublicKey: config.stripe.public_key } );
} );

async function createGiftFlow(giftForm, member) {
	try {
		return await GiftFlows.create({
			sessionId: 'UNKNOWN',
			setupCode: generateMemberCode(giftForm),
			giftForm,
			member
		});
	} catch (saveError) {
		const {code, message} = saveError;
		if (code === 11000 && message.indexOf('setupCode') > -1) {
			return await createGiftFlow(giftForm, member);
		}
		throw saveError;
	}
}

app.post( '/', hasSchema( createGiftSchema ).orReplyWithJSON, wrapAsync( async ( req, res ) => {
	let error;

	const startDate = moment(req.body.startDate).endOf('day');
	if (startDate.isBefore()) {
		error = 'flash-gifts-date-in-the-past';
	} else if (startDate.isBefore(moment('2019-11-01'))) {
		req.log.error({
			app: 'gift',
			action: 'buy-gift-before-implementation',
			message: 'Attempted to buy gift before implementation date',
			sensitive: req.body
		});
		error = 'flash-gifts-being-implemented';
	} else {
		const member = await Members.findOne({email: req.body.email});
		if (member) {
			error = 'flash-gifts-email-duplicate';
		}
	}

	if (error) {
		res.status(400).send([Options.getText(error)]);
	} else {
		const giftFlow = await createGiftFlow(req.body, req.user);

		const session = await stripe.checkout.sessions.create({
			success_url: config.audience + '/gift/thanks/' + giftFlow._id,
			cancel_url: config.audience + '/gift',
			customer_email: req.body.fromEmail,
			payment_method_types: ['card'],
			line_items: [{
				name: 'Gift membership',
				amount: 3600,
				currency: 'gbp',
				quantity: 1
			}]
		});

		await giftFlow.update({sessionId: session.id});

		res.send({sessionId: session.id});
	}
} ) );

app.get( '/:setupCode', ( req, res ) => {
	res.render('setup');
});

app.get( '/thanks/:_id', hasModel(GiftFlows, '_id'),  ( req, res ) => {
	if (req.model.completed) {
		res.render('thanks', req.model.giftForm);
	} else {
		res.redirect('/gift/failed/' + req.model._id);
	}
} );

app.post( '/thanks/:_id', hasModel(GiftFlows, '_id'), wrapAsync( async ( req, res ) => {
	if (!req.model.giftForm.delivery_address.line1) {
		await req.model.update({$set: {
			'giftForm.delivery_address': {
				line1: req.body.delivery_line1,
				line2: req.body.delivery_line2,
				city: req.body.delivery_city,
				postcode: req.body.delivery_postcode
			}
		}});
	}

	res.redirect( req.originalUrl );
} ) );

app.get( '/failed/:_id', hasModel(GiftFlows, '_id'), ( req, res ) => {
	if (req.model.completed) {
		req.redirect('/gift/thanks/' + req.model._id);
	} else {
		res.render('failed', {id: req.model._id});
	}
} );

module.exports = function( config ) {
	app_config = config;
	return app;
};