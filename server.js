
const express = require('express');
const path = require('path');

process.env["NODE_ENV"] = "testing";
process.env["FORGE_BUCKET"] = `vrparty1`;
process.env["PORT"] = 8080;


let app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(require('./routes/auth'));
app.use(require('./routes/data'));



const port = process.env.PORT || 3000;
app.listen(port, () => { console.log(`Server listening on port ${port}`); });