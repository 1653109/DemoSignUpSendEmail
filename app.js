const express = require('express');
const hbs = require('express-handlebars');
const bodyParser = require('body-parser');
const { check } = require('express-validator/check');
const nodemailer = require('nodemailer');
const crypto = require('crypto-random-string');
const models = require('./models');
const app = express();

// Set up static folder
app.use(express.static(__dirname + '/public'));

// Set up handlebars
app.engine('hbs', hbs({
    extname: 'hbs',
    defaultLayout: 'layout',
    layoutsDir: __dirname + '/views/layouts',
    partialsDir: __dirname + '/views/partials'
}));
app.set('view engine', 'hbs');

// Set up body parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Create table
app.get('/sync', (req, res) => {
    models.sequelize
        .sync()
        .then(() => {
            res.send('tables are created!');
        });
});

// Routing
app.get('/', (req, res) => {
    res.render('index');
});

app.post('/', [
    check('email').isEmail(),
    check('password').isLength({ min: 6 }),
    check('password').equals('confirm_password')
], (req, res) => {
    const email = req.body.email;
    const password = req.body.password;

    models.User.findOrCreate({
        where: { email },
        defaults: {
            email,
            password,
            isVerified: false,
            token: crypto(16)
        }
    })
        .spread((user, created) => {
            // if user email is already exist
            if (!created) {
                return res.status(409).json('User with email address already exists');
            } else {
                const token = user.token;
                const hostUrl = process.env.hostURL || 'http://localhost:8080';
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: 'dapda1110@gmail.com',
                        pass: 'asdasd12'
                    }
                });

                const mailOptions = {
                    from: 'no-reply@mymedical.com', // sender address
                    to: email, // list of receivers
                    subject: '[MyMedical] Verify Your Email"', // Subject line
                    html: `<p>Click on this link to verify your email ${hostUrl}/verification?token=${token}&email=${email}</p>`// plain text body
                };

                return transporter.sendMail(mailOptions, (err, info) => {
                    if (err) {
                        console.log(err);
                    } else {
                        res.json(info);
                    }
                });
            }
        })
        .catch((error) => {
            return res.status(500).json(error);
        });

});

app.get('/verification', (req, res) => {
    const email = req.query.email;
    const token = req.query.token;

    models.User
        .findOne({
            where: { email }
        })
        .then(user => {
            if (user.isVerified) {
                res.send('<h1>Email Already Verified</h1>');
            } else {
                if (token === user.token) {
                    return user
                        .update({ isVerified: true })
                        .then(updatedUser => {
                            return res.send(`<h1>User with ${user.email} has been verified</h1>`);
                        })
                        .catch(reason => {
                            return res.status(403).json(`Verification failed`);
                        });
                }
            }
        })
        .catch(reason => {
            return res.status(404).json(`Email not found`);
        });
});

// Start Server
const port = process.env.PORT || 8080;
app.listen(port, () => {
    console.log(`Server is up at port ${port}`);
});