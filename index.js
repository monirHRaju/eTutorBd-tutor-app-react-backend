const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");

// stripe
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const port = process.env.PORT || 3000;
// const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString(
//   'utf-8'
// )
// const serviceAccount = JSON.parse(decoded)
const serviceAccount = require("./serviceAccountKey.json");
const { generateJobId } = require("../frontend/src/utilities");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});


// middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
    optionSuccessStatus: 200,
  })
);
app.use(express.json());

// jwt middlewares
const verifyJWT = async (req, res, next) => {
  const token = req?.headers?.authorization?.split(" ")[1];
  console.log(token);
  if (!token) return res.status(401).send({ message: "Unauthorized Access!" });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.tokenEmail = decoded.email;
    console.log(decoded);
    next();
  } catch (err) {
    console.log(err);
    return res.status(401).send({ message: "Unauthorized Access!", err });
  }
};

// Create a MongoClient with a MongoClientOptions object to set the Stable API version

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
    // database and collections
    const eTutorBd_db = client.db("eTutorBd_db");
    const userCollection = eTutorBd_db.collection("users");
    const tuitionCollection = eTutorBd_db.collection("tuitions");
    const applicationCollection = eTutorBd_db.collection("applications");
    const paymentCollection = eTutorBd_db.collection("payments");

    // user related apis

    app.post("/users", async (req, res) => {
      const userData = req.body;
      // user.role = 'user';
      userData.createdAt = new Date().toLocaleString();
      userData.status = "pending";
      const query = {
        email: userData.email,
      };
      const userExists = await userCollection.findOne(query);

      if (!userExists) {
        const data = await userCollection.insertOne(userData);
        return res.send(data)
      }
      
      res.send({ acknowledged: true });

    });

    
    app.patch("/users/:email", async (req, res) => {
      const userData = req.body
      const email = req.params.email;
      const query = { email };
      const updateDoc = {
        $set: userData
      };
      const result = await userCollection.updateOne(query, updateDoc);

      res.send(result);
    });


    //get all users
    app.get("/users", async (req, res) => {
      const myEmail = req.query.email
      const query = {
        email : {$ne : myEmail}
      };
      const cursor = userCollection.find(query).sort({ createdAt: -1 });
      const result = await cursor.toArray();

      res.send(result);
    });

    app.get("/user", async (req, res) => {
      const email = req.body;
      const query = {};
      query.email = email;

      const user = await userCollection.findOne(query);

      res.send(user);
    });

    app.delete("/users/:userId/delete", async (req, res) => {
      const userId = req.params.userId;
      const query = { _id: new ObjectId(userId) };

      const result = await userCollection.deleteOne(query);

      res.send(result);
    });


    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await userCollection.findOne(query);
      // console.log(result)
      res.send({ role: user?.role });
    });

    app.get("/user-info", async (req, res) => {
      const email = req.query.email;
      const query = { email };
      const user = await userCollection.findOne(query);
      console.log(user)
      res.send(user);
    });

    app.get("/tutor-info/:email/email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await userCollection.findOne(query);
      // console.log(result)
      res.send({ role: user?.role });
    });
    
    app.patch("/users/:id", async (req, res) => {
      const role = req.body.role;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: role,
        },
      };
      const result = await userCollection.updateOne(query, updateDoc);

      res.send(result);
    });

    app.get("/tutors/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      
      const result = await userCollection.findOne(query);

      res.send(result);
    });

    app.patch("/users/:id/status", async (req, res) => {
      const status = req.body.status;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: status,
        },
      };
      const result = await userCollection.updateOne(query, updateDoc);

      res.send(result);
    });

    //tuitions related apis
    app.post("/tuitions", async (req, res) => {
      const tuitionData = req.body;
      tuitionData.createdAt = new Date().toLocaleString();
      tuitionData.jobId = generateJobId()

      const result = await tuitionCollection.insertOne(tuitionData);

      res.send(result);
    });

    app.patch("/tuitions/:tuitionId/status", async (req, res) => {
      const status = req.body.status;
      const tuitionId = req.params.tuitionId;
      const query = { _id: new ObjectId(tuitionId) };
      const updateDoc = {
        $set: {
          status: status,
        },
      };
      const result = await tuitionCollection.updateOne(query, updateDoc);

      res.send(result);
    });

    app.delete("/tuitions/:tuitionId/delete", async (req, res) => {
      const tuitionId = req.params.tuitionId;
      const query = { _id: new ObjectId(tuitionId) };

      const result = await tuitionCollection.deleteOne(query);

      res.send(result);
    });

    app.get("/not-enrolled-accepted-tuitions", async (req, res) => {
      const query = {
        status: "accepted",
        tutorEnrolled: { $ne: true }

      };
      const result = await tuitionCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();
      // console.log(result)
      res.send(result);
    });


    
    app.get("/not-enrolled-accepted-latest-tuitions", async (req, res) => {
      const query = {
        status: "accepted",
        tutorEnrolled: { $ne: true }

      };
      const result = await tuitionCollection
        .find(query)
        .limit(8)
        .sort({ createdAt: -1 })
        .toArray();
      // console.log(result)
      res.send(result);
    });

    app.get("/all-accepted-tuitions-client", async (req, res) => {
      
      const {limit=0, skip=0} = req.query
      const tuitions = await tuitionCollection
        .find()
        .limit(Number(limit))
        .skip(Number(skip))
        .sort({ createdAt: -1 })
        .toArray();
     
        const count = await tuitionCollection.countDocuments();
        
      res.send({tuitions, total:count});
    });

    app.get("/all-tuitions", async (req, res) => {
      const result = await tuitionCollection
        .find()
        .sort({ createdAt: -1 })
        .toArray();
      // console.log(result)
      res.send(result);
    });

    app.get("/tuitions/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await tuitionCollection.findOne(query);
      res.send(result);
    });

    app.get("/tuitions/:email/student", async (req, res) => {
      const email = req.params.email;
      const query = { studentEmail: email, tutorEnrolled: { $ne: true } };

      const result = await tuitionCollection.find(query).sort({ createdAt: -1 }).toArray();
      res.send(result);
    });

    //application related apis
    app.post("/applications", async (req, res) => {
      const applicationInfo = req.body;
      applicationInfo.createdAt = new Date().toLocaleString();

      const result = await applicationCollection.insertOne(applicationInfo);

      res.send(result);
    });

    app.get("/applications/:tuitionId", async (req, res) => {
      const tuitionId = req.params.tuitionId;
      const query = { tuitionId: tuitionId };

      const result = await applicationCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();

      res.send(result);
    });

    app.get("/applications/:email/tutor", async (req, res) => {
      const email = req.params.email;
      const query = {
        tutorEmail: email,
      };
      const result = await applicationCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();

      res.send(result);
    });
    
    app.get("/enrolled-applications/:email", async (req, res) => {
      const email = req.params.email;
      const query = {
        tutorEmail: email,
        status: 'enrolled'
      };
      const result = await applicationCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();

      res.send(result);
    });

    app.get("/applications/:email/student", async (req, res) => {
      const email = req.params.email;
      const query = {
        studentEmail: email,
        status: 'enrolled'
      };
      const result = await applicationCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();

      res.send(result);
    });

    

    app.patch("/applications/:id/status", async (req, res) => {
      const status = req.body.status;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: status,
        },
      };
      const result = await applicationCollection.updateOne(query, updateDoc);

      res.send(result);
    });

    app.delete("/applications/:id", async (req, res) => {
      const applicationId = req.params.id;
      const query = { _id: new ObjectId(applicationId) };

      const result = await applicationCollection.deleteOne(query);

      res.send(result);
    });
    
    app.patch("/applications/:id/delete", async (req, res) => {
      const applicationId = req.params.id;
      const query = { _id: new ObjectId(applicationId) };

      const result = await applicationCollection.deleteOne(query);

      res.send(result);
    });

    // stripe payment related apis
    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body
      console.log(paymentInfo)
      const amount = parseInt(paymentInfo.offerPrice) * 100
      console.log({paymentInfo, amount})
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            // Provide the exact Price ID (for example, price_1234) of the product you want to sell
            price_data: {
              currency : 'BDT',
              unit_amount : amount,
              product_data: {
                name: paymentInfo.subject,
              }
            },
            quantity: 1,
          },
        ],
        customer_email : paymentInfo.tutorEmail,
        mode: "payment",
        metadata: {
          tuitionId : paymentInfo.tuitionId,
          studentId : paymentInfo.studentId,
          budget : paymentInfo.budget,
          studentName : paymentInfo.studentName,
          studentEmail : paymentInfo.studentEmail,
          tutorName : paymentInfo.tutorName,
          tutorEmail : paymentInfo.tutorEmail
        },
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`
      });

      // res.redirect(303, session.url);
      console.log(session)
      res.send({url : session.url})
      
    })

    // update after successful payment
    app.patch('/verify-payment-success', async(req, res) => {
      const sessionId = req.query.session_id

      const session = await stripe.checkout.sessions.retrieve(sessionId)
      // data to send frontend
      const amountTotal = session.amount_total/100
      const transactionId = session.payment_intent
      const tutorName = session.metadata.tutorName
      const tutorEmail = session.metadata.tutorEmail
      const tuitionId = session.metadata.tuitionId
      const budget = session.metadata.budget
      const studentName = session.metadata.studentName
      const studentEmail = session.metadata.studentEmail
      const paymentStatus = session.payment_status

      //add payment data to mongo db
       const query = { transactionId };

      const paymentExist = await paymentCollection.findOne(query);
        if (paymentExist) {
          return res.send({
            success: true,
            message: "Payment already processed",
            transactionId,
            matchedCount: paymentExist.matchedCount || 1
          });
        }
       
       

      

      console.log('session retrieve', session)
      if(paymentStatus === 'paid'){
        
        // reject all applications for a tuition
        const applicationQuery = {tuitionId}
        const rejectedApplicationUpdate = {
          $set : {
            status : 'rejected',
            updatedAt : new Date().toLocaleString()
          }
        }
        await applicationCollection.updateMany(applicationQuery, rejectedApplicationUpdate)
        // console.log('rejected', rejectedTuitionResult);
        //accept one application after rejecting all from those
        const enrolledQuey = {
          tuitionId : tuitionId,
          tutorEmail
        }
        const enrolledApplicationUpdate = {
          $set : {
            status : 'enrolled',
            updatedAt : new Date().toLocaleString()
          }
        }
        const enrolledTuitionResult = await applicationCollection.updateOne(enrolledQuey, enrolledApplicationUpdate)
        console.log('enrolled', enrolledTuitionResult);

        //accept one from rejected list
        const query = {_id : new ObjectId(tuitionId)}
        const update =  {
          $set : {
            tutorEnrolled : true,
            tutorEmail,
            updatedAt : new Date().toLocaleString()
          }
        }
        const tuitionUpdateResult = await tuitionCollection.updateOne(query, update)

        console.log('tuition enrolled update:', tuitionUpdateResult)
        const matchedCount = tuitionUpdateResult.matchedCount

        const paymentData = {
          amountTotal, 
          transactionId,
          tuitionId, 
          tutorName,
          tutorEmail,
          studentName, 
          studentEmail,
          status : "paid",
          matchedCount, budget, 
          createdAt : new Date().toLocaleString(),
          updatedAt : new Date().toLocaleString()
        }
        
        const resultPayment = await paymentCollection.insertOne(paymentData)
        

        return res.send({
        success: true,
        matchedCount,
        transactionId,
        insertPaymentInfo: resultPayment
      });
      }

      res.send({success : false})
    })


    // tutor related apis
    app.get("/tutors", async (req, res) => {
      const query = {
        role: "tutor",
        status : "accepted"
      };
      const cursor = userCollection.find(query).sort({ createdAt: -1 });
      const result = await cursor.toArray();

      res.send(result);
    });
    app.get("/accepted-latest-tutors", async (req, res) => {
      const query = {
        role: "tutor",
        status : "accepted"
      };
      const cursor = userCollection.find(query).limit(4).sort({ createdAt: -1 });
      const result = await cursor.toArray();

      res.send(result);
    });

    //payment related api
    app.get("/student-payments", async (req, res) => {
      const studentEmail = req.query.email
      const query = {
        studentEmail : studentEmail
      };
      const cursor = paymentCollection.find(query).sort({ updatedAt: -1 });
      const result = await cursor.toArray();

      res.send(result);
    });
  
    app.get("/tutor-payments", async (req, res) => {
      const tutorEmail = req.query.email
      const query = {
        tutorEmail : tutorEmail
      };
      const cursor = paymentCollection.find(query).sort({ updatedAt: -1 });
      const result = await cursor.toArray();

      res.send(result);
    });
  
    app.get("/all-payments", async (req, res) => {
      const cursor = paymentCollection.find().sort({ updatedAt: -1 });
      const result = await cursor.toArray();

      res.send(result);
    });
  
  } finally {
    // Ensures that the client will close when you finish/error
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from Server..");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
})
