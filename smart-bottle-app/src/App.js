
import React, {Component} from 'react';
import ReactDOM from 'react-dom';

import Image from 'react-bootstrap/Image';

import test_img from './imgs/test.jpg';
import glow_bottle_img from './imgs/bottle.jpg';
import cad_img from './imgs/cad.png';
import camera_img from './imgs/camera.png';
import lid_img from './imgs/lid_only.png';
import whole_bottle_img from './imgs/whole_bottle.png';
import candy_img from './imgs/candy.png';
import inertial_img from './imgs/inertial+legend.png';
import sam_img from './imgs/sam.png';
import yolo_img from './imgs/yolo.png';
import overlap_img from './imgs/overlap_shortest.png';
import conf_img from './imgs/conf.png';
import integration1_img from './imgs/integreation1.png';
import integration2_img from './imgs/integreation2.png';

import './css/App.css';

class App extends Component{

  render(){

    return (
      <div className="background">
          <div style={{display:"flex", alignItems:"center", flexWrap:"wrap"}}>
            <div className="my-container" style={{marginTop:"150px"}}>
              <p className="title">
                Multimodal Sensing for Tracking Medication Adherence
              </p>
              <p className="sub-title">
                Final Term Project for EE 382V - Activity Sensing and Recognition
              </p>
              <p className="sub-title" style={{fontStyle:'italic'}}>
                Corey Karnei, Connor Fritz
              </p>
            </div>

          <div className="my-container">
            <p className="sub-heading">Motivation</p>
            <p className="txt">
            Estimates from the World Health Organization indicate that patients in developed countries only
            take about 50% of prescribed medicines for chronic diseases like hypertension and diabetes. Although
            seniors are the largest consumers of healthcare resources, studies indicate that as many as 55% of them do
            not properly take their medications and up to 30% of all hospital readmissions are due to medication
            non-adherence <a href="#ref1" id="ref1b">[1]</a>. Not only is this non-adherence damaging the health of the individuals it affects, in
            many cases it can be life threatening. It’s reported that as many as 125,000 people die every year due to
            failure to take their prescription medication <a href="#ref2" id="ref2b">[2]</a>. Additionally, in patients that suffer from chronic mental
            illness medication non-adherence rates can be as high as 40-50%. Unlike senior citizens, medication
            non-adherence in chronically mentally ill patients is often conscious and not due to forgetfulness.
            Medication non-adherence in these patients can lead to hospitalizations, self-harm, violence or suicide <a href="#ref3" id="ref3b">[3]</a>.
            </p>
            <br></br>
            <br></br>
            <p className="txt">
            Because medication non-adherence can cause financial and social harm, it would be beneficial for
            both physicians and patients to be able to track and detect instances of medication adherence, and by
            extension, non-adherence. Furthermore, a system for detecting medication adherence would have to be
            both mobile and robust for instances in which a patient tries to ‘trick’ the system. Our project aims to
            provide a proof-of-concept in which both camera and inertial data is used to distinguish pill taking
            behaviors. Future works could extend this system to obscure the cameras and inertial sensors while also
            taking steps to eliminate privacy concerns - thus providing a mobile system that is more difficult to ‘trick’
            than the smart pill bottles currently on the market.
            </p>
          </div>

          <div className="my-container">
            <p className="sub-heading"> Prior Work </p>
            <p className="txt">
            A significant body of research has been conducted to improve adherence to prescription
            medications through various interventions. Several researchers have attempted to detect pill-taking
            gestures using wrist-mounted inertial sensors <a href="#ref4" id="ref4b">[4]</a><a href="#ref5" id="ref5b">[5]</a>. One group equipped a pill bottle with an inertial
            sensor to classify activities <a href="#ref6" id="ref6b">[6]</a>. Others have embedded pill bottle lids with sensors that detect whether the
            container is open or not <a href="#ref7" id="ref7b">[7]</a><a href="#ref8" id="ref8b">[8]</a>. One approach involved RFID chips on pill bottles to detect if the bottle is
            taken from a medicine cabinet combined with face detection and tracking from a stationary camera <a href="#ref9" id="ref9b">[9]</a>.
            Many of these papers tried to increase adherence by reminding the user when they fail to take their
            medication. We aimed to develop a system that could be applicable for senior citizens as well as mentally ill
            patients who don’t take their medicine by choice rather than by accident. We believe that our approach is
            novel due to the combination of inertial and video sensing, and because the cameras are able to move with
            the bottle. More specifically, we could not find other projects that applied hand and face
            tracking to data from mobile cameras mounted on the bottle.
            </p>

            <Image src={glow_bottle_img} className="img" rounded />
            <p className="fig-description">Fig 2. Existing Smart Bottle Prototype </p>

          </div>

          <div className="my-container">
            <p className="sub-heading">Procedure</p>
            <p className="txt">
            Our plan was to build a system for tracking medication intake behavior using a combination of inertial
            sensing and computer vision. To this end, we employed an inertial sensor to classify what action was
            being performed to the pill bottle, an internal camera that would serve to indicate
            whether the bottle cap had been removed, and external cameras that would recognize when
            a pill-taking motion had happened. In combination, these would be able to give a
            physician a good sense as to whether a patient had taken a pill or not.
            </p>
            <br></br>
            <br></br>
            <p className="txt">
            To mount the internal and external cameras to the pill bottle, we
            3-d modeled and printed a plastic piece that would attach to the pill bottle’s cap, and could
            house 4 cameras facing in each direction.
            </p>
            <Image src={cad_img} className="img" rounded />
            <p className="fig-description">Fig 2. 3D Model for Camera Mount </p>
            <br></br>
            <br></br>

            <p className="txt">
            We employed several miniature
            cameras purchased online to record video while the pill bottle
            was in use. Each miniature camera cost about $15 and was attached
            to the 3D printed mount with a velcro strip.
            </p>
            <Image src={camera_img} className="img" rounded />
            <p className="fig-description">Fig 3. Miniature Camera </p>
            <br></br>
            <br></br>

            <p className="txt">
            We also used a cell phone
            running the app sensorlog to capture inertial data, which was attached to the bottom
            of the bottle. The internal camera was affixed to the underside of the bottle cap.
            </p>
            <Image src={lid_img} className="img" rounded />
            <p className="fig-description">Fig 4. Internal Camera Fixation </p>
            <br></br>
            <br></br>

            <p className="txt">
            The final design is shown below, with the cameras affixed to the mount and the phone attached
            to the bottom of the assembly.
            </p>
            <Image src={whole_bottle_img} className="img" rounded />
            <p className="fig-description">Fig 5. Complete Design </p>

            <br></br>
            <br></br>
            <hr></hr>
            <br></br>

            <p className="txt">
            A total of 5 particpants were recruited to gather data for this project. Each participant was presented
            with a script that detailed specific actions for the participants to make sequentially. They were instructed to
            repeat the steps of the script 10 times, taking one pill each time for a total of 50 pill-taking moments. All participants
            completed their tasks on the same day and in the same location. Each person was also filmed with a smartphone while they
            performed the tasks for the purpose of gathering the 'true labels' for each model.
            </p>
          </div>

          <div className="my-container">
            <p className="sub-heading"> Results </p>
            <p className="txt">
              As previously stated, three different models were employed; one for the internal camera, one for the inertial sensor,
              and one for the external cameras. Each will be described in more detail here.
            </p>
            <br></br>
            <hr></hr>
            <br></br>
            <p className="sub-sub-heading"> Internal Camera - Model 1 </p>
            <p className="txt">
              To detect whether the the pill bottle cap had been removed, we
              trained a simple convolutional neural network (CNN) on the footage from the
              internal camera. Within the CNN, the RELU activtion function was used. All
              images from the camera were scaled to a 64x64 pixel size and were
              converted to gradyscale to increase the speed and decrease the memory consumption
              of the CNN. Additionally, the resizing of the images mutated the time
              stamps at the bottom left corner of each image, thereby minimizing
              the chance that these could be erroneosly used as features by
              the CNN. Image augmentations were
              also perfomed via brightening/darkening and vertcial flipping to increase the size of the
              data set and the accuracy of the model. Shown below is an example image from the internal
              camera.
            </p>
            <Image src={candy_img} className="img" rounded />
            <p className="fig-description">Fig 6. Internal Camera View When Bottle Closed </p>
            <br />
            <br />
            <p className="txt">
            This method achieved a 91% leave one participant out cross validation (LOPOCV) accuracy on just the
            raw image set, and 94% LOPOCV when the data set was expanded by 100% with augmented images. However, using
            a CNN to detect whether or not the bottle is opened or closed would not be
            the best method to employ in a consumer product. A switch would have a near 100% accuracy
            while also being smaller, cheaper, and less battery intensive than a machine learning
            approach. However, applying a CNN to this particular problem
            taught us more about image manipulation and the image labelling process.
            </p>
            <br></br>
            <hr></hr>
            <br></br>
            <p className="sub-sub-heading"> Inertial Sensor - Model 2 </p>
            <p className="txt">
            For the inertial sensor, we extracted 4 features from each dimension of movement :
            mean, variance, skew, and kurtosis. We then used a random forest classifier
            to determine what activity was being performed. Below, you can
            see a snippet of the data which contains 4 pill-taking moments. The true labels
            were created manually after watching the smartphone video recorded separately.
            In each pill-taking gesture, you can see it go from stationary to picking up to getting pill
            to putting down.
            </p>
            <Image src={inertial_img} className="img" rounded />
            <p className="fig-description">Fig 7. Inertial Sensor Data </p>
            <br />
            <br />
            <p className="txt">
            We reached 95% accuracy when trained on a random split,
            and 85% when using LOPOCV. These results are reasonable,
            and since most pill bottles spend most of the time in one spot, it is
            very unlikely that an entire pill taking moment would be completely
             missed by this model.
            </p>
            <br></br>
            <hr></hr>
            <br></br>
            <p className="sub-sub-heading"> External Cameras - Model 3 </p>
            <p className="txt">
              To detect when a pill has been taken, we made use of an existing
              system, YOLOv4 <a href="#ref10" id="ref10b">[10]</a>.
              You only look once version 4 (YOLOv4) is a state-of-the-art, real-time
              object detection framework. YOLOv4 is able to detect many different
              objects at once, and will provide bounding boxes wherever it
              detects each object. The default version of this tool is trained on dogs, cats,
              horses, planes, and 16 other classes. But since none of these were hands
              or faces, we sought out databases for these classes individually and trained our
              own versions of YOLOv4 to detect them both. We used the Oxford Hands Dataset <a href="#ref11" id="ref11b">[11]</a> and the
              WIDER Faces Dataset <a href="#ref12" id="ref12b">[12]</a>. While a single YOLOv4 model is able to detect multiple objects,
              we trained two separate models - one for faces and one for hands.
              This is because many of the pictures in the Oxford Hands Dataset contain
              un-annotated faces, and many of the pictures in the WIDER Faces Dataset
              contain un-annotated hands.
              If these datasets were combined to train a single YOLOv4 model,
              the model would have a difficult time learning defining features
              with so many unlabelled hands and faces present.
            </p>
            <Image src={sam_img} className="img" rounded />
            <p className="fig-description">Fig 8. External Camera Model Bounding Boxes </p>
            <br />
            <br />
            <p className="txt">
            After training our two separate YOLOv4 models, we ran the external
            camera videos through our models to generate face and hand bounding boxes.
            Pill taking instances were recorded when two
            criteria were met in the same frame. A hand and a face bounding box
            had to overlap, and the area of the hand bounding box had to be smaller
            than the area of the face bounding box. The first criterion is meant to
            detect when a participant has their hand near their face. The second
            criterion is meant to cull false positives caused when a
            participant's hand obscures their face from the camera's view.
            Pill taking instances within 1 second of one another are then grouped
            together to form pill taking moments.

            Below you can see a snippet of one pill-taking moment
            and its composite pill taking instances. On the top row in red are
            the frames where our model detected a hand. On the bottom in blue are
            the frames where our model detected a face. In the middle
            in green are the frames where both criteria are met. The
            black X indicates the true label of the pill taking moment.
            </p>
            <Image src={overlap_img} className="img" rounded />
            <p className="fig-description">Fig 9. A Pill Taking Moment </p>
            <br />
            <br />
            <p className="txt">
            Neither LOPOCV nor a train/test split
            were used to evaulate this model as the model was not trained on the external camera data.
            Instead, the participant's data was use to test the complete model.
            Overall, 80% of the 50 true pill taking moments were detected. There
            were also very few false positives. Some of the pill taking moments were only partially in frame
            and we believe this caused the accuracy to be lower than it could have been otherwise.
            In a real implementation, this could be remedied by using a fish eye lense camera,
            or by using more cameras to expand the device's field of view.
            </p>
          </div>

          <div className="my-container">
            <p className="sub-heading"> Integration </p>
            <p className="txt">
            Since this project was motivated by the desire to allow physicians to know how well their
            patients are taking their medicine, we have proposed a system for integrating these separate
            models. When given data for a period of time, say a day, each model would perform its evaluation
            independently and return a boolean indicating whether or not that model believes a pill was
            taken. These booleans could then be summed and sent to the patient’s doctor, acting as a score
            denoting how confident the system is that a pill was taken.
            </p>
            <Image src={integration1_img} className="img" rounded />
            <p className="fig-description">Fig 10. Potential Model Integration </p>
            <br />
            <br />
            <p className="txt">
            In such a system, the doctor would be able to look at a dashboard like the one below.
            </p>
            <Image src={integration2_img} className="img" style={{width:"700px"}} rounded />
            <p className="fig-description">Fig 11. Dashboard Mockup</p>
            <br />
            <br />
            <p className="txt">
            Across time, the doctor would be able to get a decent understanding of how well the
            patient has been adhering to their medication and could intervene if they see results like
            those shown in the bottom figure. Combining the predictions in this way makes the system more robust, as
            even if one of the models is wrong on a given day, across all 3 models and across multiple days
            the trend should still be clear.
            </p>
          </div>
          <div className="my-container">
            <p className="sub-heading"> Limitations and Future Work </p>
            <p className="txt">
              This work had several limiatations, most of which would be easily addressed in
              future work on this topic.
              </p>
              <br></br>
              <p className="txt">
              The first is the disconnectedness of the sensors. Each sensor was its own device
              and the fact that each one started collecting data at a slightly different time made it much more difficult to
              try and actually implement an integrated system like the one described in the previous section.
              Additionally, having to consolidate
              the data from 6 different devices made scaling up our data collection somewhat impractical. In the future,
              we would consolidate the sensors to one device, perhaps using a microcontroller, which would allow us to activate
              all the sensors at once and store the data in one location.
              </p>
              <br></br>
              <p className="txt">
              The second limitation was the limited field of view.
              Although we positioned the external cameras in all four directions, there was still a few degrees between any two cameras that
              was a blind spot. This led to errors in our object detection models,
              as some pill taking moments were not visible in the camera data.
              A fisheye lens could possibly be employed to solve this issue.
              </p>
              <br></br>
              <p className="txt">
              A final limitation pertains to privacy. Two of
              our models used cameras to capture data,
              but cameras come with a litany of privacy concerns that our work did nothing to address. To remedy this,
              an infrared camera could be used instead of standard video cameras.
              Additionally, in a consumer-ready product, the internal camera could
              be replaced by a switch of some sort. Additionally, hand and face
              detection could be run in real time on the microcontroller, and the
              camera data could be discarded.
              </p>
              <br></br>
              <p className="txt">
              Overall, if we were to extend this work further, we would create a
              system that consolidates
              the models' output into a adherence confidence score, flesh out
              and develop the propsed physician portal, and address the limitations
              listed above.
            </p>
          </div>

          <div className="my-container">
            <p className="sub-heading"> Conclusion </p>
            <p className="txt">
              In this report we described a novel, multimodal approach for tracking medication adherence.
              Three separate models were created to detect aspects of pill taking gestures.
              The first model classified whether the bottle was open or closed based
              off of data from an internal camera. This model was able to achieve
              a 94% LOPOCV accuracy. The second model used inertial data collected
              from a smartphone attached to the bottle. This model classified whether
              the bottle was stationary, being picked up, being put down, or being
              moved by the participant to obtain a pill. This model was able to achieve
              an 85% LOPOCV accuracy. The third and final model used data collected
              from four external cameras mounted to the pill bottle. This model used
              two separate YOLOv4 instances trained on outside datasets - one for hand detection, and one for
              face detection. This model combined the outputs from the YOLOv4 instances
              to detect pill taking moments with an 80% accuracy when tested on
              the totality of the external camera data. To our knowledge, this
              is the first project to use both inertial sensing and camera data
              collected from a mobile bottle to detect pill taking gestures. In
              the future, this project could be expanded by connecting the sensors,
              integrating the models, addressing privacy concerns, and creating a
              user friendly app for physicians to track patient pill taking behavior.
            </p>
          </div>

          <div className="my-container" style={{marginBottom:"0px"}}>
            <p className="sub-heading"> References </p>
            <p className="reference" id="ref1">
              <a href="#ref1b">[1]</a> “Medipense " Top 10 Reasons Seniors Do Not Take Their Medications.” Medipense, 9 May
                  2018, medipense.com/en/top-10-reasons-seniors-do-not-take-their-medications/.
            </p>
            <p className="reference" id="ref2">
              <a href="#ref2b">[2]</a> Benjamin, Regina M. “Medication Adherence: Helping Patients Take Their Medicines as
                  Directed.” Public Health Reports, vol. 127, no. 1, 2012, pp. 2–3.,
                  doi:10.1177/003335491212700102.
            </p>
            <p className="reference" id="ref3">
              <a href="#ref3b">[3]</a> Acar, Gulsah, et al. “Medication Non-Adherence in Chronic Mental Illness: Management
                  Strategies” ARC Journal of Psychiatry, vol. 2, no. 1, 2017, pp. 23-25.
            </p>
            <p className="reference" id="ref4">
              <a href="#ref4b">[4]</a> Marquard, Jenna L, et al. “Designing a Wrist-Worn Sensor to Improve Medication Adherence:
              Accommodating Diverse User Behaviors and Technology Preferences.” JAMIA Open, vol. 1, no.
              2, 2018, pp. 153–158., doi:10.1093/jamiaopen/ooy035.
            </p>

            <p className="reference" id="ref5">
              <a href="#ref5b">[5]</a> Kalantarian, Haik, et al. “A Smartwatch-Based Medication Adherence System.” 2015 IEEE 12th
              International Conference on Wearable and Implantable Body Sensor Networks (BSN), 2015,
              doi:10.1109/bsn.2015.7299348.
            </p>

            <p className="reference" id="ref6">
              <a href="#ref6b">[6]</a> Aldeer, Murtadha, et al. “A Sensing-Based Framework for Medication Compliance Monitoring.”
              Proceedings of the 1st ACM International Workshop on Device-Free Human Sensing - DFHS'19,
              2019, doi:10.1145/3360773.3360886.
            </p>

            <p className="reference" id="ref7">
              <a href="#ref7b">[7]</a> Reese, Peter P., et al. “Automated Reminders and Physician Notification to Promote
              Immunosuppression Adherence Among Kidney Transplant Recipients: A Randomized Trial.”
              American Journal of Kidney Diseases, W.B. Saunders, 7 Dec. 2016,
              www.sciencedirect.com/science/article/pii/S0272638616305972.
            </p>

            <p className="reference" id="ref8">
              <a href="#ref8b">[8]</a> Shellmer, Diana A., and Nataliya Zelikovsky. “The Challenges of Using Medication Event
              Monitoring Technology with Pediatric Transplant Patients.” Pediatric Transplantation, vol. 11,
              no. 4, 2007, pp. 422–428., doi:10.1111/j.1399-3046.2007.00681.x.
            </p>

            <p className="reference" id="ref9">
              <a href="#ref9b">[9]</a> Hasanuzzaman, Faiz M., et al. “Monitoring Activity of Taking Medicine by Incorporating RFID
              and Video Analysis.” Network Modeling Analysis in Health Informatics and Bioinformatics, vol.
              2, no. 2, 2013, pp. 61–70., doi:10.1007/s13721-013-0025-y.
            </p>

            <p className="reference" id="ref10">
              <a href="#ref10b">[10]</a> Bochkovskiy, Alexey, et al. "YOLOv4: Optimal Speed and Accuracy of Object Detection."
              arXiv preprint arXiv:2004.10934v1, 2020
            </p>

            <p className="reference" id="ref11">
              <a href="#ref11b">[11]</a> Mittal, A., et al. "Hand Detection Using Multiple Proposals"
              British Machine Vision Conference, 2011
            </p>

            <p className="reference" id="ref12">
              <a href="#ref12b">[12]</a> Yang, Shuo, et al. "WIDER FACE: A Face Detection Benchmark"
              IEEE Conference on Computer Vision and Pattern Recognition, 2016
            </p>

          </div>

        </div>
      </div>
    );
  }
}

export default App;
