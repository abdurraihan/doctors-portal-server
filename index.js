const express = require('express')

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
// const { get } = require('express/lib/response');
const nodemailer = require('nodemailer');
const mg = require('nodemailer-mailgun-transport');


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

const auth = {
  auth: {
    api_key: "a746a879d9208f6a358cabd9da770bcc-8d821f0c-9e17c3ac",
    domain: "sandbox9c67eeb158c54bca97f19493d0e407fc.mailgun.org",
  }
}

const nodemailerMailgun = nodemailer.createTransport(mg(auth));

function sendAppointmentEmail(booking) {
  const { patient, patientName, treatment, date, slot } = booking;

  var email = {
    from: "support@phero.com",
    to: patient,
    subject: `Your Appointment for ${treatment} is on ${date} at ${slot} is Confirmed`,
    text: `Your Appointment for ${treatment} is on ${date} at ${slot} is Confirmed`,
    html: `
      <div>
        <p> Hello ${patientName}, </p>
        <h3>Your Appointment for ${treatment} is confirmed</h3>
        <p>Looking forward to seeing you on ${date} at ${slot}.</p>
        <h3>Our Address</h3>
        <p>Andor Killa Bandorban</p>
        <p>Bangladesh</p>
        <a href="https://web.programming-hero.com/">unsubscribe</a>
      </div>
    `,
  };

  nodemailerMailgun.sendMail(email, (err, info) => {
    if (err) {
      console.log(err);
    } else {
      console.log(info);
    }
  });
}



async function run() {
  try {

    await client.connect();
    const serviceCollection = client.db('doctors_portal').collection('services');
    const bookingCollection = client.db('doctors_portal').collection('booking');
    const userCollection = client.db('doctors_portal').collection('user');
    const doctorCollection = client.db('doctors_portal').collection('doctors');


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


    const verifyAdmin = async ( req , res , next) =>{
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({email: requester});

      if(requesterAccount.role === 'admin'){
        next()
      }
      else{
        res.status(403).send({message: 'forbidden'});
      }

    }



    app.get('/service', async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query).project({name:1})
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
      console.log(booking);
      const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists });
      }

      const result = await bookingCollection.insertOne(booking);
      console.log("sending email");
      sendAppointmentEmail(booking);
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

      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5h' })

      res.send({ result, token });

    });


    // update

    app.put('/user/admin/:email', verifyJWT, verifyAdmin,  async (req, res) => {
      const email = req.params.email;
      
      const filter = { email: email };
      const updateDoc = {
        $set: { role: 'admin' },
      };

      const result = await userCollection.updateOne(filter, updateDoc);

      res.send(result);

    });






    // get all user for dashboard all users
    app.get('/users', verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    })

    //post for doctors in dashboard AddDoctors
    app.post('/doctor',verifyJWT,verifyAdmin,   async(req , res) =>{
        const doctor = req.body;
        const result = await doctorCollection.insertOne(doctor);
        res.send(result);
    })

 //post for doctors in dashboard manage doctor

app.get('/doctor',verifyJWT, verifyAdmin, async(req, res) => {
  const doctors = await doctorCollection.find().toArray();
  res.send(doctors);

})

app.delete('/doctor/:id',verifyJWT, verifyAdmin, async(req, res) => {
  const id = req.params;
  
  const query =  {_id: ObjectId(id)}  ;
  const result = await doctorCollection.deleteOne(query);
  res.send(result);

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

/* 
 const email = {
  from: 'myemail@example.com',
    to: 'abdurraihan898@gmail.com', 
  
    subject: 'Hey you, awesome!',
    
    text: 'Mailgun rocks, pow pow!'
}


app.get('/email', async(req,res)=>{

  nodemailerMailgun.sendMail(email , (err, info) => {
    if (err) {
      console.log(err);
    }
    else {
      console.log(info);
    }
  }); 


  res.send({status:true});

} ) */

app.get('/', (req, res) => {
  res.send('doctors portal is running ')
})

app.listen(port, () => {
  console.log(`doctors portals app listening on port ${port}`)
})