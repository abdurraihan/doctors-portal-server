const express = require('express')
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { get } = require('express/lib/response');

const app = express()
require('dotenv').config()

// middleware
app.use(cors())
app.use(express.json())

const port = process.env.PORT || 5000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wakpm.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: 'UnAuthorized access' })
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'Forbidden access' })
    }

    req.decoded = decoded;
    // console.log(decoded) // bar
    next();
  });

}

async function run() {
  try {

    await client.connect();
    const serviceCollection = client.db('doctors_portal').collection('services');
    const bookingCollection = client.db('doctors_portal').collection('booking');
    const userCollection = client.db('doctors_portal').collection('user');


    /** 
     * API Naming convention
     * app.get('/booking') // get all booking in this collection . or get more than one or by filter
     * app.get('/booking/:id) // get a specific booking 
     * app.post('/booking') // add a new booking
     * app.patch('/booking/:id) // update
     * app.delete('/booking/:id) // delete
     * 
     *  
     * **/






    app.get('/service', async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query)
      const services = await cursor.toArray();
      res.send(services);
    })

    //
    // this is not the proper away to query 
    // after learning more about mongodb . user aggregate lookup , pipeline , match , group 
    app.get('/available', async (req, res) => {
      const date = req.query.date || "May 16, 2022";

      // step 1: get all service 
      const services = await serviceCollection.find().toArray();

      // step 2: get the booking of that day . output [{} , {}, {}, {}, .... more]
      const query = { date: date };
      const bookings = await bookingCollection.find(query).toArray();


      //step 3: for each service , find booking for that service 
      services.forEach(service => {
        // step 4: find booking for that service . output [{}, {}, {}, {}]
        const serviceBookings = bookings.filter(b => b.treatment === service.name)
        // step 5: select slots for the service bookings : [" ", " ", " ", " "]
        const booked = serviceBookings.map(s => s.slot);
        // step 6: select those slots that are not in bookedSlots
        const available = service.slots.filter(s => !booked.includes(s));
        // step 7 : set available to slots to make it easier 
        service.slots = available;
      })

      res.send(services);
    })




    // get for dashboard

    app.get('/booking', verifyJWT, async (req, res) => {
      const patient = req.query.patient;
      const decodedEmail = req.decoded.email;
      // console.log('auth header', authorization);
      if (patient == decodedEmail) {
        const query = { patient: patient };
        const booking = await bookingCollection.find(query).toArray();
        res.send(booking);

      }

      else {
        return res.status(403).send({ message: 'forbidden access ' });
      }

    })

    // post 

    app.post('/booking', async (req, res) => {
      const booking = req.body;

      const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists });
      }

      const result = await bookingCollection.insertOne(booking);

      return res.send({ success: true, result });

    })



    // update user data 


    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };

      const updateDoc = {
        $set: user,
      };


      const result = await userCollection.updateOne(filter, updateDoc, options);

      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

      res.send({ result, token });

    });


    // update admin

    app.put('/user/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({email: requester});

      if(requesterAccount.role === 'admin'){

        
      const filter = { email: email };
      const updateDoc = {
        $set: { role: 'admin' },
      };

      const result = await userCollection.updateOne(filter, updateDoc);

      res.send(result);

      }

      else{
        res.status(403).send({message: 'forbidden'});
      }

    });






    // get all user for dashboard all users
    app.get('/users', verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    })

    //for admin rout private 

    app.get('/admin/:email', async(req , res) =>{
      const email = req.params.email;
      const user = await userCollection.findOne({email:email});

      const isAdmin = user.role == 'admin';
      res.send({admin: isAdmin})
    })

    //end 

  }
  finally {

  }
}

run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('doctors portal is running ')
})

app.listen(port, () => {
  console.log(`doctors portals app listening on port ${port}`)
})