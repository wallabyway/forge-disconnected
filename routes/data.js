const fetch = require('node-fetch');
const zip = require('node-zip');
const zlib = require('zlib');
const express = require('express');

const { AuthenticationClient, DataManagementClient } = require('autodesk-forge-tools');
//const BaseUrl = 'https://developer.api.autodesk.com';
const BaseUrl = 'https://otg.autodesk.com';
const Scopes = ['viewables:read', 'data:read'];

let router = express.Router();
let auth = new AuthenticationClient(process.env.FORGE_CLIENT_ID, process.env.FORGE_CLIENT_SECRET);
let data = new DataManagementClient(auth);

// GET /api/models
// Returns a JSON array of objects in our application's bucket ($FORGE_BUCKET),
// with each item in the array containing properties 'bucketKey', 'objectKey',
// 'objectId', 'sha1', 'size', and 'location'.
router.get('/api/models', async function(req, res, next) {
    try {
        let objects = [];
        for await (const page of data.objects(process.env.FORGE_BUCKET)) {
            objects.push(...page);
        }
        res.json(objects);
    } catch(err) {
        next(err);
    }
});



// GET /api/models/:urn/files
// Returns a JSON list of all derivatives for a given model URN
// and a list of files each derivative depends on.
router.get('/api/models/:urn/files', async function(req, res, next) {
    try {
        //const authentication = await auth.authenticate(Scopes);
        //const manifest = await getManifest(req.params.urn, authentication.access_token);
        const urls = [{
            basePath:`urn:adsk.fluent:fs.file:tcollmo-p-ue1-viewables/vrparty1/Enscape%20Modern%20Residence.rvt/0/output/Resource/3D_View/_3D_ 501463/`,
            files:["fragments.fl", "fragments_extra.fl", "materials_ptrs.hl", "geometry_ptrs.hl",  "../../avs.pack", "../../avs.idx", "../../dbid.idx"],
        }];
        res.json(urls);

    } catch (err) {
        next(err);
    }
});

async function getManifest(urn, token) {
    const res = await fetch(BaseUrl + `/modelderivative/v2/designdata/${urn}/manifest`, {
        compress: true,
        headers: { 'Authorization': 'Bearer ' + token }
    });
    return res.json();
}

function parseManifest(manifest) {
    const items = [];
    function parse(node) {
        const roles = [
            'Autodesk.CloudPlatform.DesignDescription',
            'Autodesk.CloudPlatform.PropertyDatabase',
            'Autodesk.CloudPlatform.IndexableContent',
            'leaflet-zip',
            'thumbnail',
            'graphics',
            'preview',
            'raas',
            'pdf',
            'lod'
        ];
        if (roles.includes(node.role)) {
            const item = {
                guid: node.guid,
                mime: node.mime
            };
            items.push(Object.assign({}, item, getPathInfo(node.urn)));
        }
        if (node.children) {
            node.children.forEach(parse);
        }
    }

    parse({ children: manifest.derivatives });
    return items;
}

function getPathInfo(encodedURN) {
    const urn = decodeURIComponent(encodedURN);
    const rootFileName = urn.slice(urn.lastIndexOf('/') + 1);
    const basePath = urn.slice(0, urn.lastIndexOf('/') + 1);
    const localPath = basePath.slice(basePath.indexOf('/') + 1).replace(/^output\//, '');
    return {
        urn,
        rootFileName,
        localPath,
        basePath
    };
}

async function getDerivative(urn, token) {
        const res = await fetch(BaseUrl + `/modeldata/file/${urn}`, {
        //const res = await fetch(BaseUrl + `/derivativeservice/v2/derivatives/${urn}`, {
        compress: true,
        headers: { 'Authorization': 'Bearer ' + token }
    });
    const buff = await res.buffer();
    return buff;
}

async function getDerivativesSVF(urn, token) {
    const data = await getDerivative(urn, token);
    const pack = new zip(data, { checkCRC32: true, base64: false });
    const manifestData = pack.files['manifest.json'].asNodeBuffer();
    const manifest = JSON.parse(manifestData.toString('utf8'));
    if (!manifest.assets) {
        return [];
    }

    return manifest.assets
        .map(asset => asset.URI)
        .filter(uri => uri.indexOf('embed:/') === -1);
}

async function getDerivativesF2D(item, token) {
    const manifestPath = item.basePath + 'manifest.json.gz';
    const data = await getDerivative(manifestPath, token);
    const manifestData = zlib.gunzipSync(data);
    const manifest = JSON.parse(manifestData.toString('utf8'));
    if (!manifest.assets) {
        return [];
    }

    return manifest.assets
        .map(asset => asset.URI)
        .filter(uri => uri.indexOf('embed:/') === -1)
        .concat(['manifest.json.gz']);
}

module.exports = router;