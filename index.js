const express = require('express')
const { MongoClient, ServerApiVersion } = require('mongodb');
var cors = require('cors')
const app = express()
require('dotenv').config()

// middleware
app.use(cors())
app.use(express.json())

const port = process.env.PORT || 5000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wakpm.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run(){
    try{

        await client.connect();
        const serviceCollection = client.db('doctors_portal').collection('services');

       app.get('/service', async (req, res) =>{
           const query = {};
           const cursor = serviceCollection.find(query)
           const services = await cursor.toArray();
           res.send(services);
       })

    }
    finally{

    }
}

run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('doctors portal is running ')
})

app.listen(port, () => {
  console.log(`doctors portals app listening on port ${port}`)
})