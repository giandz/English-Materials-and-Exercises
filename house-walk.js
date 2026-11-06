/* ══════════════════════════════════════════════════════════════════════════
   house-walk.js — house characters on the move: the keyframe editor's animations
   (character-keyframes.html, files in animations/) played in the house, and a way
   round the house from one spot to another.

   Load it after house-character.js (and house-engine.js for HouseWalk.route).

     HouseWalk.ANIMS                    the animations, by id: walking, running, sitting-down,
                                        standing-up, entering-bed, exiting-bed, going-upstairs,
                                        going-downstairs, treading-water (a swimmer staying put). The copies built in
                                        here are the files in animations/ as they were saved from
                                        the keyframe editor; HouseWalk.load() fetches the folder's
                                        own files over them (so editing one in the keyframe editor
                                        changes how people move), HouseWalk.add(id, json) adds one.
     HouseWalk.frames(id)               how many frames one play (or one cycle of a loop) lasts
     HouseWalk.pose(id, frame, c)       character c in that animation's pose at that frame (its own
                                        look, face and clothes; the animation's joints, turns and head,
                                        and its eyes if it moves them) → { d, lift, shift } with lift
                                        (up) and shift (sideways, + toward the back of a side view)
                                        in metres
     HouseWalk.route(eng, L, from, to, opts)
                                        a way from [x, y] to [x, y] on floor L that keeps clear of
                                        walls, windows, fences, columns, stairs, furniture and pools,
                                        and goes through doors and gates → [[x, y], …] or null
                                        opts.radius  how far from anything the middle of a person
                                                     keeps (0.2 m); opts.others  [[x, y], …] people
                                                     standing about; opts.pool  true: the pools are
                                                     water to wade into, not walls
     HouseWalk.journey(eng, La, a, Lb, b, opts)
                                        a way from [x, y] on floor La to [x, y] on floor Lb, up or
                                        down the stairs (the shortest, if there are several) →
                                        { legs, segs: [{ L, pts }], len } or null: legs for trip()
                                        (walks, and climbs up or down each flight), segs the walking
                                        routes floor by floor. opts as route()'s, with opts.others
                                        also a function L → [[x, y], …], and opts.gait for the legs
     HouseWalk.trip(character, legs)    a whole outing, as legs played one after another:
       { walk: [[x, y], …], gait: 'walking' | 'running', swimIn: fn(x, y), L, z }  along a route
                                                (on floor L, z metres above it: a landing)
       { climb: [[x, y], [x, y]], z0, z1, steps, down, L, gait }   up (or down) one flight of
                                                stairs from floor L, played with going-upstairs (or
                                                going-downstairs), one step a tread
       { play: id, x, y, facing, speed }        an animation on the spot (sitting-down,
                                                standing-up…); its shift moves the person along
                                                the way they face, from (x, y) where shift is 0
       { turn: degrees, x, y }                  turn round on the spot, standing
       { ladder: [[x, y], [x, y]], up, steps, L }   down a pool ladder, from the deck to the water (or up it,
                                                from the water to the deck), facing the deck all the way,
                                                played with going-upstairs (backwards going down);
                                                at(t) says swim, and sink: 0 on the deck … 1 swimming
       { reach: 'open' | 'close' | 'flick' | 'high', door, x, y, facing, dur, toggle }   a hand out in front and back (opening
                                                or closing a door, flicking a switch): trip.events gets
                                                { t, door, L, action, toggle } at the middle of it, when the
                                                door should open or shut (toggle: whatever the page passed)
       { stand: seconds, x, y, facing }         wait
       { act: id, x, y, facing, into: true }    get into one of the ACTS below (eased from standing
                                                into its pose, then doing it for a moment)
       { act: id, x, y, facing, out: true }     stop doing it: eased back to standing
     → { seconds, at(t) } where at(t) gives what to draw t seconds in: { x, y, z, facing,
       d (the posed character), leg, u (0–1 through the leg), done, L (the floor, when the legs
       say), ground (the height under the feet, on stairs and landings), seg (the leg's own seg) }

     HouseWalk.ACTS                     things people do at a piece of furniture or an appliance, and
                                        where they stand for it. The spots are the deduction lessons'
                                        (deduction-house.js: Mom cooking at the stove, Dad washing the
                                        dishes, Grandma in the shower, Lucas having a snack by the
                                        fridge), measured from the piece in its own frame: u across it,
                                        v out from its middle toward its front, turn = which way the
                                        person faces against the piece's front (180: facing it)
     HouseWalk.actPose(c, id)           character c standing and doing it (its pose, what it holds,
                                        and swimwear for the shower)
     HouseWalk.actSpot(frame, id)       → { x, y, facing } for a piece's frame { cx, cy, dir }

   Walking speed follows the gait and the person's size: an average adult's walking cycle
   (two steps) covers 1.3 m, a running one 2.4 m, and the cycle is played by distance
   covered, so the feet keep pace with the floor.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  const HC = () => global.HouseCharacter;

  /* the animations, as saved by the keyframe editor, kept short: the first keyframe's pose
     (joints, turns, head, lift, shift) and each timeline as [frame, value, easeIn?, easeOut?] */
  const ANIMS = {"walking":{"fps":24,"length":24,"loop":true,"loopOut":23,"base":{"joints":{"root":0,"pelvis":0,"torso":-3,"neck":2,"shoulderL":4,"elbowL":8,"wristL":0,"shoulderR":-4,"elbowR":8,"wristR":0,"hipL":0,"kneeL":0,"ankleL":80,"hipR":0,"kneeR":0,"ankleR":80},"torsoOrientation":-90,"pelvisOrientation":-90,"head":"left","headNod":0,"lift":0,"shift":0},"tracks":{"hipL":[[0,28],[3,22],[6,4],[9,-12],[12,-22],[15,-16],[18,10],[21,28],[24,28]],"kneeL":[[0,-4],[3,-20],[6,-6],[9,-4],[12,-14],[15,-42],[18,-64],[21,-30],[24,-4]],"ankleL":[[0,70],[3,78],[6,82],[9,90],[12,100],[15,112],[18,124],[21,92],[24,70]],"hipR":[[0,-22],[3,-16],[6,10],[9,28],[12,28],[15,22],[18,4],[21,-12],[24,-22]],"kneeR":[[0,-14],[3,-42],[6,-64],[9,-30],[12,-4],[15,-20],[18,-6],[21,-4],[24,-14]],"ankleR":[[0,100],[3,112],[6,124],[9,92],[12,70],[15,78],[18,82],[21,90],[24,100]],"shoulderL":[[0,-24],[3,-18],[6,-4],[9,12],[12,24],[15,18],[18,4],[21,-10],[24,-24]],"elbowL":[[0,10],[3,12],[6,16],[9,24],[12,30],[15,26],[18,18],[21,12],[24,10]],"shoulderR":[[0,24],[3,18],[6,4],[9,-10],[12,-24],[15,-18],[18,-4],[21,12],[24,24]],"elbowR":[[0,30],[3,26],[6,18],[9,12],[12,10],[15,12],[18,16],[21,24],[24,30]]}},"running":{"fps":24,"length":16,"loop":true,"loopOut":15,"base":{"joints":{"root":0,"pelvis":0,"torso":-12,"neck":9,"shoulderL":4,"elbowL":8,"wristL":0,"shoulderR":-4,"elbowR":8,"wristR":0,"hipL":0,"kneeL":0,"ankleL":80,"hipR":0,"kneeR":0,"ankleR":80},"torsoOrientation":-90,"pelvisOrientation":-90,"head":"left","headNod":0,"lift":0,"shift":0},"tracks":{"hipL":[[0,40],[2,18],[4,-12],[6,-30],[8,-20],[10,18],[12,60],[14,56],[16,40]],"kneeL":[[0,-20],[2,-42],[4,-16],[6,-26],[8,-80],[10,-118],[12,-96],[14,-44],[16,-20]],"ankleL":[[0,72],[2,104],[4,94],[6,104],[8,112],[10,112],[12,102],[14,82],[16,72]],"hipR":[[0,-20],[2,18],[4,60],[6,56],[8,40],[10,18],[12,-12],[14,-30],[16,-20]],"kneeR":[[0,-80],[2,-118],[4,-96],[6,-44],[8,-20],[10,-42],[12,-16],[14,-26],[16,-80]],"ankleR":[[0,112],[2,112],[4,102],[6,82],[8,72],[10,104],[12,94],[14,104],[16,112]],"shoulderL":[[0,-46],[2,-34],[4,-6],[6,26],[8,48],[10,36],[12,10],[14,-24],[16,-46]],"elbowL":[[0,72],[2,76],[4,84],[6,92],[8,96],[10,92],[12,84],[14,76],[16,72]],"shoulderR":[[0,48],[2,36],[4,10],[6,-24],[8,-46],[10,-34],[12,-6],[14,26],[16,48]],"elbowR":[[0,96],[2,92],[4,84],[6,76],[8,72],[10,76],[12,84],[14,92],[16,96]],"lift":[[0,0],[2,0],[4,0],[6,5],[8,0],[10,0],[12,0],[14,5],[16,0]]}},"sitting-down":{"fps":24,"length":36,"loop":false,"base":{"joints":{"root":0,"pelvis":0,"torso":0,"neck":0,"shoulderL":4,"elbowL":8,"wristL":0,"shoulderR":-4,"elbowR":8,"wristR":0,"hipL":0,"kneeL":0,"ankleL":80,"hipR":0,"kneeR":0,"ankleR":80},"torsoOrientation":-90,"pelvisOrientation":-90,"head":"left","headNod":0,"lift":0,"shift":0},"tracks":{"shoulderL":[[0,4,"linear","sine"],[8,14,"sine","linear"],[16,38],[22,26,"linear","sine"],[30,10,"sine","linear"]],"elbowL":[[0,8,"linear","sine"],[8,14,"sine","linear"],[16,24],[22,44,"linear","sine"],[30,60,"sine","linear"]],"shoulderR":[[0,-4,"linear","sine"],[8,10,"sine","linear"],[16,32],[22,28,"linear","sine"],[30,20,"sine","linear"]],"elbowR":[[0,8,"linear","sine"],[8,14,"sine","linear"],[16,26],[22,40,"linear","sine"],[30,50,"sine","linear"]],"hipL":[[0,0,"linear","sine"],[8,22,"sine","linear"],[16,62],[22,86,"linear","sine"],[30,90,"sine","linear"]],"kneeL":[[0,0,"linear","sine"],[8,-36,"sine","linear"],[16,-88],[22,-92,"linear","sine"],[30,-88,"sine","linear"]],"ankleL":[[0,80,"linear","sine"],[8,94,"sine","linear"],[16,106],[22,86,"linear","sine"],[30,80,"sine","linear"]],"hipR":[[0,0,"linear","sine"],[8,22,"sine","linear"],[16,64],[22,88,"linear","sine"],[30,93,"sine","linear"]],"kneeR":[[0,0,"linear","sine"],[8,-36,"sine","linear"],[16,-88],[22,-92,"linear","sine"],[30,-88,"sine","linear"]],"ankleR":[[0,80,"linear","sine"],[8,94,"sine","linear"],[16,104],[22,84,"linear","sine"],[30,80,"sine","linear"]],"torso":[[0,0,"linear","sine"],[8,-16,"sine","linear"],[16,-38],[22,-22,"linear","sine"],[30,0,"sine","linear"]],"neck":[[0,0,"linear","sine"],[8,7,"sine","linear"],[16,18],[22,11,"linear","sine"],[30,0,"sine","linear"]],"shift":[[0,-40.1],[2,-39.3],[6,-35.2],[8,-34.6],[11,-27.9],[15,-22.1],[16,-21.6],[18,-15.4],[22,-5.4],[23,-5.4],[29,0],[30,0]]}},"standing-up":{"fps":24,"length":40,"loop":false,"base":{"joints":{"root":0,"pelvis":0,"torso":0,"neck":0,"shoulderL":4,"elbowL":8,"wristL":0,"shoulderR":-4,"elbowR":8,"wristR":0,"hipL":0,"kneeL":0,"ankleL":80,"hipR":0,"kneeR":0,"ankleR":80},"torsoOrientation":-90,"pelvisOrientation":-90,"head":"left","headNod":0,"lift":0,"shift":0},"tracks":{"shoulderL":[[6,10,"linear","sine"],[14,26,"sine","linear"],[20,38],[28,14,"linear","sine"],[36,4,"sine","linear"]],"elbowL":[[6,60,"linear","sine"],[14,44,"sine","linear"],[20,24],[28,14,"linear","sine"],[36,8,"sine","linear"]],"shoulderR":[[6,20,"linear","sine"],[14,28,"sine","linear"],[20,32],[28,10,"linear","sine"],[36,-4,"sine","linear"]],"elbowR":[[6,50,"linear","sine"],[14,40,"sine","linear"],[20,26],[28,14,"linear","sine"],[36,8,"sine","linear"]],"hipL":[[6,90,"linear","sine"],[14,86,"sine","linear"],[20,62],[28,22,"linear","sine"],[36,0,"sine","linear"]],"kneeL":[[6,-88,"linear","sine"],[14,-92,"sine","linear"],[20,-88],[28,-36,"linear","sine"],[36,0,"sine","linear"]],"ankleL":[[6,80,"linear","sine"],[14,86,"sine","linear"],[20,106],[28,94,"linear","sine"],[36,80,"sine","linear"]],"hipR":[[6,93,"linear","sine"],[14,88,"sine","linear"],[20,64],[28,22,"linear","sine"],[36,0,"sine","linear"]],"kneeR":[[6,-88,"linear","sine"],[14,-92,"sine","linear"],[20,-88],[28,-36,"linear","sine"],[36,0,"sine","linear"]],"ankleR":[[6,80,"linear","sine"],[14,84,"sine","linear"],[20,104],[28,94,"linear","sine"],[36,80,"sine","linear"]],"torso":[[6,0,"linear","sine"],[14,-22,"sine","linear"],[20,-38],[28,-16,"linear","sine"],[36,0,"sine","linear"]],"neck":[[6,0,"linear","sine"],[14,11,"sine","linear"],[20,18],[28,7,"linear","sine"],[36,0,"sine","linear"]],"shift":[[6,0],[7,0],[13,-5.4],[14,-5.4],[18,-15.4],[20,-21.6],[21,-22.1],[25,-27.9],[28,-34.6],[30,-35.2],[34,-39.3],[36,-40.1]]}},"entering-bed":{"fps":24,"length":86,"loop":false,"base":{"joints":{"root":0,"pelvis":0,"torso":0,"neck":0,"shoulderL":4,"elbowL":8,"wristL":0,"shoulderR":-4,"elbowR":8,"wristR":0,"hipL":0,"kneeL":0,"ankleL":80,"hipR":0,"kneeR":0,"ankleR":80},"torsoOrientation":-90,"pelvisOrientation":-90,"head":"left","headNod":0,"lift":0,"shift":0},"tracks":{"shoulderL":[[0,4,"linear","sine"],[8,14,"sine","linear"],[16,38],[22,26,"linear","sine"],[30,10,"sine","sine"],[38,14],[48,12,"sine","sine"],[72,-4,"quad","linear"]],"elbowL":[[0,8,"linear","sine"],[8,14,"sine","linear"],[16,24],[22,44,"linear","sine"],[30,60,"sine","sine"],[38,56],[48,40,"sine","sine"],[72,6,"quad","linear"]],"shoulderR":[[0,-4,"linear","sine"],[8,10,"sine","linear"],[16,32],[22,28,"linear","sine"],[30,20,"sine","sine"],[38,18],[48,16,"sine","sine"],[72,-8,"quad","linear"]],"elbowR":[[0,8,"linear","sine"],[8,14,"sine","linear"],[16,26],[22,40,"linear","sine"],[30,50,"sine","sine"],[38,48],[48,34,"sine","sine"],[72,8,"quad","linear"]],"hipL":[[0,0,"linear","sine"],[8,22,"sine","linear"],[16,62],[22,86,"linear","sine"],[30,90,"sine","sine"],[38,86],[48,88,"sine","sine"],[72,0,"quad","linear"]],"kneeL":[[0,0,"linear","sine"],[8,-36,"sine","linear"],[16,-88],[22,-92,"linear","sine"],[30,-88,"sine","sine"],[38,-48],[48,-2,"sine","sine"],[72,-2,"quad","linear"]],"ankleL":[[0,80,"linear","sine"],[8,94,"sine","linear"],[16,106],[22,86,"linear","sine"],[30,80,"sine","sine"],[38,72],[48,80,"sine","sine"],[72,80,"quad","linear"]],"hipR":[[0,0,"linear","sine"],[8,22,"sine","linear"],[16,64],[22,88,"linear","sine"],[30,93,"sine","sine"],[38,88],[48,89,"sine","sine"],[72,1,"quad","linear"]],"kneeR":[[0,0,"linear","sine"],[8,-36,"sine","linear"],[16,-88],[22,-92,"linear","sine"],[30,-88,"sine","sine"],[38,-50],[48,-3,"sine","sine"],[72,-3,"quad","linear"]],"ankleR":[[0,80,"linear","sine"],[8,94,"sine","linear"],[16,104],[22,84,"linear","sine"],[30,80,"sine","sine"],[38,72],[48,80,"sine","sine"],[72,80,"quad","linear"]],"torso":[[0,0,"linear","sine"],[8,-16,"sine","linear"],[16,-38],[22,-22,"linear","sine"],[30,0,"sine","sine"],[38,6],[48,10,"sine","sine"],[72,0,"quad","linear"]],"neck":[[0,0,"linear","sine"],[8,7,"sine","linear"],[16,18],[22,11,"linear","sine"],[30,0,"sine","sine"],[38,-2],[48,-3,"sine","sine"],[72,-12,"quad","linear"]],"root":[[0,0,"linear","sine"],[8,0,"sine","linear"],[16,0],[22,0,"linear","sine"],[30,0,"sine","sine"],[38,0],[48,0,"sine","sine"],[72,90,"quad","linear"]],"eyes":[[0,"open"],[80,"closed"]],"shift":[[0,-28.1],[2,-27.3],[6,-23.2],[8,-22.6],[11,-15.9],[15,-10.1],[16,-9.6],[18,-3.4],[22,6.6],[23,6.6],[29,12],[86,12]],"lift":[[0,0],[30,0],[35,1.6],[38,6.2],[39,9.1],[40,13.5],[44,27.8],[46,32.2],[68,32.3],[69,31.7],[70,29.2],[71,27.9],[86,27.9]]}},"exiting-bed":{"fps":24,"length":92,"loop":false,"base":{"joints":{"root":0,"pelvis":0,"torso":0,"neck":0,"shoulderL":4,"elbowL":8,"wristL":0,"shoulderR":-4,"elbowR":8,"wristR":0,"hipL":0,"kneeL":0,"ankleL":80,"hipR":0,"kneeR":0,"ankleR":80},"torsoOrientation":-90,"pelvisOrientation":-90,"head":"left","headNod":0,"lift":0,"shift":0},"tracks":{"shoulderL":[[14,-4,"linear","quad"],[38,12,"sine","sine"],[48,14],[56,10,"sine","sine"],[64,26,"sine","linear"],[70,38],[78,14,"linear","sine"],[86,4,"sine","linear"]],"elbowL":[[14,6,"linear","quad"],[38,40,"sine","sine"],[48,56],[56,60,"sine","sine"],[64,44,"sine","linear"],[70,24],[78,14,"linear","sine"],[86,8,"sine","linear"]],"shoulderR":[[14,-8,"linear","quad"],[38,16,"sine","sine"],[48,18],[56,20,"sine","sine"],[64,28,"sine","linear"],[70,32],[78,10,"linear","sine"],[86,-4,"sine","linear"]],"elbowR":[[14,8,"linear","quad"],[38,34,"sine","sine"],[48,48],[56,50,"sine","sine"],[64,40,"sine","linear"],[70,26],[78,14,"linear","sine"],[86,8,"sine","linear"]],"hipL":[[14,0,"linear","quad"],[38,88,"sine","sine"],[48,86],[56,90,"sine","sine"],[64,86,"sine","linear"],[70,62],[78,22,"linear","sine"],[86,0,"sine","linear"]],"kneeL":[[14,-2,"linear","quad"],[38,-2,"sine","sine"],[48,-48],[56,-88,"sine","sine"],[64,-92,"sine","linear"],[70,-88],[78,-36,"linear","sine"],[86,0,"sine","linear"]],"ankleL":[[14,80,"linear","quad"],[38,80,"sine","sine"],[48,72],[56,80,"sine","sine"],[64,86,"sine","linear"],[70,106],[78,94,"linear","sine"],[86,80,"sine","linear"]],"hipR":[[14,1,"linear","quad"],[38,89,"sine","sine"],[48,88],[56,93,"sine","sine"],[64,88,"sine","linear"],[70,64],[78,22,"linear","sine"],[86,0,"sine","linear"]],"kneeR":[[14,-3,"linear","quad"],[38,-3,"sine","sine"],[48,-50],[56,-88,"sine","sine"],[64,-92,"sine","linear"],[70,-88],[78,-36,"linear","sine"],[86,0,"sine","linear"]],"ankleR":[[14,80,"linear","quad"],[38,80,"sine","sine"],[48,72],[56,80,"sine","sine"],[64,84,"sine","linear"],[70,104],[78,94,"linear","sine"],[86,80,"sine","linear"]],"torso":[[14,0,"linear","quad"],[38,10,"sine","sine"],[48,6],[56,0,"sine","sine"],[64,-22,"sine","linear"],[70,-38],[78,-16,"linear","sine"],[86,0,"sine","linear"]],"neck":[[14,-12,"linear","quad"],[38,-3,"sine","sine"],[48,-2],[56,0,"sine","sine"],[64,11,"sine","linear"],[70,18],[78,7,"linear","sine"],[86,0,"sine","linear"]],"root":[[14,90,"linear","quad"],[38,0,"sine","sine"],[48,0],[56,0,"sine","sine"],[64,0,"sine","linear"],[70,0],[78,0,"linear","sine"],[86,0,"sine","linear"]],"eyes":[[0,"closed"],[7,"open"]],"shift":[[0,12],[57,12],[63,6.6],[64,6.6],[68,-3.4],[70,-9.6],[71,-10.1],[75,-15.9],[78,-22.6],[80,-23.2],[84,-27.3],[86,-28.1]],"lift":[[0,27.9],[15,27.9],[16,29.2],[17,31.7],[18,32.3],[40,32.2],[42,27.8],[46,13.5],[47,9.1],[48,6.2],[51,1.6],[56,0],[86,0]]}},"going-upstairs":{"fps":24,"length":32,"loop":true,"loopOut":31,"base":{"joints":{"root":0,"pelvis":0,"torso":-12,"neck":6,"shoulderL":4,"elbowL":8,"wristL":0,"shoulderR":-4,"elbowR":8,"wristR":0,"hipL":0,"kneeL":0,"ankleL":80,"hipR":0,"kneeR":0,"ankleR":80},"torsoOrientation":-90,"pelvisOrientation":-90,"head":"left","headNod":4,"lift":0,"shift":0},"tracks":{"hipL":[[0,57],[4,45],[12,26],[14,20],[17,8],[19,3],[20,-1],[21,3],[22,10],[28,56],[29,60],[30,62],[31,61],[32,57]],"kneeL":[[0,-102],[4,-89],[10,-77],[12,-71],[14,-61],[17,-42],[19,-34],[20,-28],[21,-37],[24,-88],[25,-103],[26,-114],[27,-122],[28,-124],[29,-120],[32,-102]],"ankleL":[[0,125],[10,125],[13,123],[16,116],[17,111],[19,96],[20,90],[21,99],[22,115],[24,150],[25,164],[26,170],[27,168],[28,160],[30,138],[31,130],[32,125]],"hipR":[[0,12],[1,8],[3,3],[4,-1],[5,3],[6,10],[12,56],[13,60],[14,62],[15,61],[18,51],[21,42],[28,26],[30,20],[32,12]],"kneeR":[[0,-48],[1,-42],[3,-34],[4,-28],[5,-37],[8,-88],[9,-103],[10,-114],[11,-122],[12,-124],[13,-120],[16,-102],[20,-89],[26,-77],[28,-71],[30,-61],[32,-48]],"ankleR":[[0,116],[1,111],[3,96],[4,90],[5,99],[6,115],[8,150],[9,164],[10,170],[11,168],[12,160],[14,138],[15,130],[16,125],[27,125],[30,122],[32,116]],"shoulderL":[[0,-14],[2,-13],[4,-10],[12,10],[14,13],[16,14],[18,13],[20,10],[28,-10],[30,-13],[32,-14]],"elbowL":[[0,24],[4,22],[12,14],[16,12],[20,14],[28,22],[32,24]],"shoulderR":[[0,14],[2,13],[4,10],[12,-10],[14,-13],[16,-14],[18,-13],[20,-10],[28,10],[30,13],[32,14]],"elbowR":[[0,12],[4,14],[12,22],[16,24],[20,22],[28,14],[32,12]],"lift":[[0,5.6],[4,0],[5,2.3],[6,7.7],[7,14.6],[8,15.7],[11,11.6],[12,10.6],[15,6.6],[17,4.3],[20,0],[21,2.3],[22,7.7],[23,14.6],[24,15.5],[29,9.3],[30,8.2],[31,6.6],[32,5.6]],"shift":[[0,0],[32,0]]}},"going-downstairs":{"fps":24,"length":32,"loop":true,"loopOut":31,"base":{"joints":{"root":0,"pelvis":0,"torso":-4,"neck":2,"shoulderL":4,"elbowL":8,"wristL":0,"shoulderR":-4,"elbowR":8,"wristR":0,"hipL":0,"kneeL":0,"ankleL":80,"hipR":0,"kneeR":0,"ankleR":80},"torsoOrientation":-90,"pelvisOrientation":-90,"head":"left","headNod":10,"lift":0,"shift":0},"tracks":{"hipL":[[0,33],[5,30],[9,33],[11,34],[13,33],[20,27],[21,28],[22,32],[23,38],[25,56],[26,61],[27,62],[28,59],[29,52],[31,37],[32,33]],"kneeL":[[0,-54],[1,-57],[4,-59],[5,-62],[9,-79],[12,-88],[14,-92],[17,-95],[20,-102],[21,-106],[24,-124],[25,-125],[26,-120],[27,-110],[28,-98],[30,-71],[31,-60],[32,-54]],"ankleL":[[0,79],[1,83],[2,89],[5,110],[6,115],[11,132],[13,137],[16,144],[17,144],[19,141],[20,141],[22,149],[23,150],[24,149],[25,143],[26,132],[29,98],[30,89],[31,82],[32,79]],"hipR":[[0,30],[4,27],[5,28],[6,32],[7,38],[9,56],[10,61],[11,62],[12,59],[13,52],[15,37],[16,33],[21,30],[25,33],[27,34],[29,33],[32,30]],"kneeR":[[0,-94],[1,-95],[4,-102],[5,-106],[8,-124],[9,-125],[10,-120],[11,-110],[12,-98],[14,-71],[15,-60],[16,-54],[17,-57],[20,-59],[21,-62],[25,-79],[27,-86],[29,-90],[32,-94]],"ankleR":[[0,144],[1,144],[3,141],[4,141],[6,149],[7,150],[8,149],[9,143],[10,132],[13,98],[14,89],[15,82],[16,79],[17,83],[18,89],[21,110],[22,115],[27,132],[29,137],[32,144]],"shoulderL":[[0,-14],[2,-13],[4,-10],[12,10],[14,13],[16,14],[18,13],[20,10],[28,-10],[30,-13],[32,-14]],"elbowL":[[0,24],[4,22],[12,14],[16,12],[20,14],[28,22],[32,24]],"shoulderR":[[0,14],[2,13],[4,10],[12,-10],[14,-13],[16,-14],[18,-13],[20,-10],[28,10],[30,13],[32,14]],"elbowR":[[0,12],[4,14],[12,22],[16,24],[20,22],[28,14],[32,12]],"lift":[[0,0],[1,1.2],[6,8.7],[7,9.8],[12,16],[13,11.7],[14,6.2],[15,1.6],[16,0],[17,1.2],[22,8.7],[23,9.8],[28,16],[29,11.7],[30,6.2],[31,1.6],[32,0]],"shift":[[0,0],[32,0]]}},"treading-water":{"fps":24,"length":40,"loop":true,"loopOut":39,"base":{"joints":{"root":0,"pelvis":0,"torso":0,"neck":0,"shoulderL":-70,"elbowL":-30,"wristL":0,"shoulderR":70,"elbowR":30,"wristR":0,"hipL":-12,"kneeL":0,"ankleL":0,"hipR":12,"kneeR":0,"ankleR":0},"torsoOrientation":0,"pelvisOrientation":0,"head":"front","headNod":0,"lift":0,"shift":0},"tracks":{"shoulderL":[[0,-73.0],[5,-62.4],[10,-58.0],[15,-62.4],[20,-73.0],[25,-83.6],[30,-88.0],[35,-83.6],[40,-73.0]],"elbowL":[[0,-10.0],[5,-15.1],[10,-27.5],[15,-39.9],[20,-45.0],[25,-39.9],[30,-27.5],[35,-15.1],[40,-10.0]],"shoulderR":[[0,73.0],[5,62.4],[10,58.0],[15,62.4],[20,73.0],[25,83.6],[30,88.0],[35,83.6],[40,73.0]],"elbowR":[[0,10.0],[5,15.1],[10,27.5],[15,39.9],[20,45.0],[25,39.9],[30,27.5],[35,15.1],[40,10.0]],"hipL":[[0,-11.0],[5,-7.5],[10,-6.0],[15,-7.5],[20,-11.0],[25,-14.5],[30,-16.0],[35,-14.5],[40,-11.0]],"kneeL":[[0,0.0],[5,-2.6],[10,-9.0],[15,-15.4],[20,-18.0],[25,-15.4],[30,-9.0],[35,-2.6],[40,0.0]],"hipR":[[0,11.0],[5,7.5],[10,6.0],[15,7.5],[20,11.0],[25,14.5],[30,16.0],[35,14.5],[40,11.0]],"kneeR":[[0,0.0],[5,2.6],[10,9.0],[15,15.4],[20,18.0],[25,15.4],[30,9.0],[35,2.6],[40,0.0]],"lift":[[0,0],[10,2.2],[20,0],[30,2.2],[40,0]],"shift":[[0,0],[40,0]]}}};

  /* a full animation file (house-animation/1) in the short form above */
  function compact(a) {
    if (!a || !Array.isArray(a.keys) || !a.keys.length) return null;
    const p = a.keys[0].pose || {};
    const base = { joints: Object.assign({}, p.joints || {}), torsoOrientation: +p.torsoOrientation || 0, pelvisOrientation: +p.pelvisOrientation || 0,
      head: p.head || 'front', headNod: +p.headNod || 0, lift: +p.lift || 0, shift: +p.shift || 0 };
    const tracks = {};
    (a.tracks || []).forEach(t => {
      if (!t || typeof t.param !== 'string' || !Array.isArray(t.keys) || !t.keys.length || t.off) return;
      tracks[t.param] = t.keys.map(k => { const r = [k.frame, k.value]; if (k.easeIn !== 'linear' || k.easeOut !== 'linear') r.push(k.easeIn, k.easeOut); return r; })
        .sort((x, y) => x[0] - y[0]);
    });
    const out = { fps: +a.fps || 24, length: +a.length || 24, loop: !!a.loop, base, tracks };
    if (a.loopOut != null) out.loopOut = +a.loopOut;
    if (a.loopIn != null) out.loopIn = +a.loopIn;
    return out;
  }
  function add(id, json) { const c = json && json.base ? json : compact(json); if (c) ANIMS[id] = c; return !!c; }
  /* the animations folder next to the page: newer versions of the built-in animations (or more) */
  function load(dir, ids) {
    dir = dir == null ? 'animations/' : dir;
    ids = ids || Object.keys(ANIMS);
    if (typeof fetch !== 'function' || (typeof location !== 'undefined' && location.protocol === 'file:')) return Promise.resolve(0);
    return Promise.all(ids.map(id => fetch(dir + id + '.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null)
      .then(j => (j && add(id, j) ? 1 : 0)).catch(() => 0))).then(n => n.reduce((a, b) => a + b, 0));
  }
  /* frames in one play: a loop runs from loopIn to loopOut (the frame after loopOut is loopIn again) */
  function span(A) {
    const lo = A.loop && A.loopIn != null ? A.loopIn : 0;
    const hi = A.loop && A.loopOut != null ? A.loopOut + 1 : A.length;
    return [lo, Math.max(lo + 1, hi)];
  }
  const frames = id => { const A = ANIMS[id]; if (!A) return 0; const [lo, hi] = span(A); return hi - lo; };

  /* the frame in a stair cycle's first half where the body is lowest (a foot just down on a tread):
     a climb starts and ends there, so it starts and ends standing level */
  function footDown(id) {
    const A = ANIMS[id], K = A && A.tracks.lift; if (!K) return 0;
    let best = 0, bv = Infinity;
    for (let f = 0; f < frames(id) / 2; f++) { const v = trackValue('lift', K, f); if (v < bv - 1e-9) { bv = v; best = f; } }
    return best;
  }
  const wrap = v => ((v + 180) % 360 + 360) % 360 - 180;
  const isJoint = k => HC().JOINTS.some(j => j[0] === k);
  function trackValue(id, K, f) {
    const H = HC();
    if (f <= K[0][0]) return K[0][1];
    if (f >= K[K.length - 1][0]) return K[K.length - 1][1];
    let i = 0; while (K[i + 1][0] <= f) i++;
    const A = K[i], B = K[i + 1];
    if (f === A[0] || typeof A[1] !== 'number') return A[1];
    const e = H.ease((f - A[0]) / (B[0] - A[0]), A[3] || 'linear', B[2] || 'linear');
    return isJoint(id) ? wrap(A[1]) + H.jointDelta(id, A[1], B[1]) * e : A[1] + (B[1] - A[1]) * e;
  }
  /* the animation's pose on a character: joints, turns and head from the animation; eyes
     only if it has them on a timeline; everything else (face, clothes, held things) the
     character's own. Cached by character and frame. */
  const memo = new Map();
  function pose(id, frame, character) {
    const A = ANIMS[id]; if (!A) return null;
    const H = HC(), f = Math.round(frame);
    const ck = character && character.__hwKey ? character.__hwKey : JSON.stringify(character);
    const key = id + '|' + f + '|' + ck;
    if (memo.has(key)) return memo.get(key);
    const d = H.normalize(character);
    const b = A.base;
    Object.assign(d.joints, b.joints);
    d.torsoOrientation = b.torsoOrientation; d.pelvisOrientation = b.pelvisOrientation; d.head = b.head; d.headNod = b.headNod;
    d.prop = null; d.back = false; d.flipped = false;
    let lift = b.lift, shift = b.shift;
    for (const k in A.tracks) {
      const v = trackValue(k, A.tracks[k], f);
      if (k === 'lift') lift = v;
      else if (k === 'shift') shift = v;
      else if (isJoint(k)) d.joints[k] = Math.round(v * 10) / 10;
      else if (k === 'torsoOrientation' || k === 'pelvisOrientation' || k === 'headNod') d[k] = v;
      else if (k === 'head' || k === 'eyes' || k === 'eyebrows' || k === 'mouth') d[k] = v;
    }
    const out = { d: H.normalize(d), lift: lift / 100, shift: shift / 100 };
    // a side view's head faces the way the body does
    out.d.head = b.head;
    if (memo.size > 600) memo.delete(memo.keys().next().value);
    memo.set(key, out);
    return out;
  }

  /* ── finding a way round the house ─────────────────────────────────────
     The floor is cut into 10 cm cells. A cell is closed if its middle is closer than the
     person's radius to anything solid; a route runs through open cells (8 ways, A*), and is
     then pulled tight: corners are dropped wherever the straight line stays in open cells. */
  const RES = 0.1;
  function grid(eng, L, opts) {
    const st = eng.state, F = st.floors[L], r = opts.radius != null ? opts.radius : 0.2;
    const W = Math.round(st.COLS / RES), Hh = Math.round(st.ROWS / RES);
    const shut = new Uint8Array(W * Hh);
    const box = (x0, y0, x1, y1, grow) => {
      const g = grow == null ? r : grow;
      const c0 = Math.max(0, Math.floor((x0 - g) / RES)), c1 = Math.min(W - 1, Math.ceil((x1 + g) / RES) - 1);
      const r0 = Math.max(0, Math.floor((y0 - g) / RES)), r1 = Math.min(Hh - 1, Math.ceil((y1 + g) / RES) - 1);
      for (let j = r0; j <= r1; j++) {
        const cy = (j + 0.5) * RES, dy = Math.max(y0 - cy, 0, cy - y1);
        for (let i = c0; i <= c1; i++) {
          const cx = (i + 0.5) * RES, dx = Math.max(x0 - cx, 0, cx - x1);
          if (dx * dx + dy * dy < g * g || (dx === 0 && dy === 0)) shut[j * W + i] = 1;
        }
      }
    };
    // the edge of the lot
    box(-1, -1, st.COLS + 1, 0); box(-1, st.ROWS, st.COLS + 1, st.ROWS + 1); box(-1, -1, 0, st.ROWS + 1); box(st.COLS, -1, st.COLS + 1, st.ROWS + 1);
    const T = eng.T || 0.16, J = 0.09;   // wall thickness; a door's or gate's frame on each side of the opening
    for (const [k, v] of F.edges) {
      const e = eng.parseKey(k), [[x0, y0], [x1, y1]] = eng.edgeEnds(e.o, e.r, e.c);
      const open = v.type === 'door' || (v.type === 'fence' && v.gate);
      const th = v.type === 'fence' ? 0.06 : T / 2;
      if (!open) { box(Math.min(x0, x1) - th, Math.min(y0, y1) - th, Math.max(x0, x1) + th, Math.max(y0, y1) + th); continue; }
      if (e.o === 'h') { box(x0 - th, y0 - th, x0 + J, y0 + th); box(x1 - J, y1 - th, x1 + th, y1 + th); }
      else { box(x0 - th, y0 - th, x0 + th, y0 + J); box(x1 - th, y1 - J, x1 + th, y1 + th); }
    }
    for (const k of F.columns) { const [X, Y] = eng.colXY(k), h = (eng.COL_W || 0.24) / 2; box(X / 2 - h, Y / 2 - h, X / 2 + h, Y / 2 + h); }
    const solid = R => box(R.x0, R.y0, R.x1, R.y1);
    F.furniture.forEach((f, i) => {
      if (opts.ignore && opts.ignore.includes(i)) return;
      if (eng.hung(f) && !(eng.FURN[f.type].hangZ < 0.5)) return;   // shelves and cabinets on the wall are over people's heads
      solid(eng.furnRect(f));
    });
    (F.appliances || []).forEach(a => { if (a.type !== 'rug') solid(eng.applRect(a)); });
    /* Stairs. Those going up from this floor are solid (a floating stair has room to walk
       under its high end); the hole of a stair coming up from the floor below is open except
       for its top two treads, which are at this floor's level — people step off there. */
    const pools = L === 0 ? st.floors[0].pools : [];
    const RISE = (eng.LEVEL_H || 2.8) / 14;
    if (opts.noStairs) { /* only walls and things: is there room to stand by a stair? */ }
    else if (eng.stairTreads) {
      F.stairs.forEach(s => eng.stairTreads(s).forEach(t => {
        if (s.style === 'cantilever' && t.riser * RISE - 0.1 > 2.05) return;
        box(t.rect.x0, t.rect.y0, t.rect.x1, t.rect.y1);
      }));
      if (st.floors[L - 1]) st.floors[L - 1].stairs.forEach(s => eng.stairTreads(s).forEach(t => {
        if (!t.landing && t.riser >= 13) return;
        box(t.rect.x0, t.rect.y0, t.rect.x1, t.rect.y1);
      }));
      // between the treads and the stair's own squares (the rail, the stringers): the squares less
      // the treads' insets are solid too — except round the hole's floor-level top
    } else {
      // an older engine: every stair square is solid
      const below = st.floors[L - 1] && st.floors[L - 1].stairs.length;
      for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
        const x = (i + 0.5) * RES, y = (j + 0.5) * RES;
        if ((F.stairs.length && eng.stairIndexAt(L, x, y) >= 0) || (below && eng.stairIndexAt(L - 1, x, y) >= 0)) shut[j * W + i] = 1;
      }
    }
    if (!opts.pool) pools.forEach(q => box(q.c0, q.r0, q.c1, q.r1));
    (opts.others || []).forEach(([x, y]) => box(x - 0.15, y - 0.15, x + 0.15, y + 0.15));
    return { W, H: Hh, shut, r };
  }
  const cellOf = (G, x, y) => [Math.max(0, Math.min(G.W - 1, Math.floor(x / RES))), Math.max(0, Math.min(G.H - 1, Math.floor(y / RES)))];
  const mid = (i, j) => [(i + 0.5) * RES, (j + 0.5) * RES];
  // the open cell nearest a point (within 1 m)
  function nearestOpen(G, x, y) {
    const [ci, cj] = cellOf(G, x, y);
    if (!G.shut[cj * G.W + ci]) return [ci, cj];
    let best = null, bd = Infinity;
    const R = Math.round(1 / RES);
    for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= G.W || j >= G.H || G.shut[j * G.W + i]) continue;
      const [mx, my] = mid(i, j), d = Math.hypot(mx - x, my - y);
      if (d < bd) { bd = d; best = [i, j]; }
    }
    return best;
  }
  // the straight line from a to b stays in open cells
  function clear(G, a, b) {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (RES / 3));
    for (let s = 0; s <= n; s++) {
      const x = a[0] + (b[0] - a[0]) * s / n, y = a[1] + (b[1] - a[1]) * s / n;
      const [i, j] = cellOf(G, x, y); if (G.shut[j * G.W + i]) return false;
    }
    return true;
  }
  // the straight line from a to b goes through a wall, a window or a fence (not a door or a gate)
  function crossesWall(eng, L, a, b) {
    const F = eng.state.floors[L]; if (!F) return false;
    const d = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    for (const [k, v] of F.edges) {
      if (v.type === 'door' || (v.type === 'fence' && v.gate)) continue;
      const e = eng.parseKey(k), [p, q] = eng.edgeEnds(e.o, e.r, e.c);
      if (d(a, b, p) * d(a, b, q) < 0 && d(p, q, a) * d(p, q, b) < 0) return true;
    }
    return false;
  }
  /* a roomy way if there is one (opts.radius, 0.2 m), or else a squeeze (0.12 m): between a
     toilet and a basin, or past a chair pushed in */
  function route(eng, L, from, to, opts) {
    opts = opts || {};
    const r0 = opts.radius != null ? opts.radius : 0.2;
    for (const r of r0 > 0.12 ? [r0, 0.12] : [r0]) {
      const out = routeAt(eng, L, from, to, Object.assign({}, opts, { radius: r }));
      if (out) return out;
    }
    return null;
  }
  function routeAt(eng, L, from, to, opts) {
    const G = grid(eng, L, opts);
    const s = nearestOpen(G, from[0], from[1]), g = nearestOpen(G, to[0], to[1]);
    if (!s || !g) return null;
    const W = G.W, N = W * G.H, start = s[1] * W + s[0], goal = g[1] * W + g[0];
    const gs = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    // a binary heap of [f, index]
    const heap = [];
    const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const hx = i => { const dx = Math.abs(i % W - g[0]), dy = Math.abs(((i / W) | 0) - g[1]); return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy); };
    gs[start] = 0; push(hx(start), start);
    const STEPS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    while (heap.length) {
      const [, cur] = pop();
      if (done[cur]) continue;
      done[cur] = 1;
      if (cur === goal) break;
      const ci = cur % W, cj = (cur / W) | 0;
      for (const [di, dj, c] of STEPS) {
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= W || j >= G.H) continue;
        const n = j * W + i;
        if (G.shut[n] || done[n]) continue;
        if (di && dj && (G.shut[cj * W + i] || G.shut[j * W + ci])) continue;   // no cutting a corner
        const ng = gs[cur] + c;
        if (ng < gs[n]) { gs[n] = ng; came[n] = cur; push(ng + hx(n), n); }
      }
    }
    if (!done[goal]) return null;
    const cells = [];
    for (let k = goal; k !== -1; k = came[k]) cells.push(mid(k % W, (k / W) | 0));
    cells.reverse();
    // pull it tight
    const pts = [cells[0]];
    let a = 0;
    while (a < cells.length - 1) {
      let b = cells.length - 1;
      while (b > a + 1 && !clear(G, cells[a], cells[b])) b--;
      pts.push(cells[b]); a = b;
    }
    /* from where they really are, to where they are really going: the grid's own first and last
       cells are dropped when they are only a few centimetres off, so the person doesn't take a
       little sideways step at either end (and end up facing some odd way) */
    const out = [from.slice()], near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.25;
    pts.forEach(p => { if (!near(p, out[out.length - 1])) out.push(p); });
    if (out.length > 1 && near(to, out[out.length - 1])) out[out.length - 1] = to.slice();
    else out.push(to.slice());
    // where the grid's ends were moved off something, the hop to the real spot must not go through a wall
    if (out.length > 1 && (crossesWall(eng, L, out[0], out[1]) || crossesWall(eng, L, out[out.length - 2], out[out.length - 1]))) return null;
    return out.filter((p, i) => !i || Math.hypot(p[0] - out[i - 1][0], p[1] - out[i - 1][1]) > 1e-3);
  }

  /* ── from floor to floor ─────────────────────────────────────────────
     A staircase on floor L joins L and L + 1 (house-engine.js stairFlights: each flight a climb
     from in front of its first tread to the middle of its last, which on the top flight is level
     with the floor above). Going up: walk to the foot of the first flight, climb, cross a landing,
     climb, and walk on from the top tread. Going down is the same backwards. Each floor on the way
     picks the stair that makes the whole way shortest. */
  /* the ways onto a staircase from the floor below: from in front of it, or stepping onto the first
     tread from either side (a stair whose foot is against a wall) → [{ start, pieces }]; going down,
     the same backwards → [{ end, pieces }] */
  function stairWays(eng, s, down) {
    const P = eng.stairFlights(s), f = P[0], out = [{ start: f.climb[0], pieces: P }];
    if (f.tread1 && f.steps > 1) {
      const R = (f.z1 - f.z0) / f.steps;
      f.sides.forEach(sd => out.push({ start: sd, pieces: [{ climb: [sd, f.tread1], z0: f.z0, z1: f.z0 + R, steps: 1 },
        { climb: [f.tread1, f.climb[1]], z0: f.z0 + R, z1: f.z1, steps: f.steps - 1 }, ...P.slice(1)] }));
    }
    if (!down) return out;
    return out.map(w => ({ end: w.start, pieces: w.pieces.slice().reverse().map(q => q.climb ? { climb: [q.climb[1], q.climb[0]], z0: q.z1, z1: q.z0, steps: q.steps, down: true } : { walk: q.walk.slice().reverse(), z: q.z }) }));
  }
  // somewhere a person can stand on floor L: not in a wall or anything solid (with a squeeze)
  function standable(eng, L, pt, opts) {
    const G = grid(eng, L, Object.assign({}, opts, { radius: 0.1, noStairs: true })), [i, j] = cellOf(G, pt[0], pt[1]);
    return pt[0] > 0 && pt[1] > 0 && pt[0] < eng.state.COLS && pt[1] < eng.state.ROWS && !G.shut[j * G.W + i];
  }
  const lenOf = r => r.reduce((t, p, i) => i ? t + Math.hypot(p[0] - r[i - 1][0], p[1] - r[i - 1][1]) : 0, 0);
  function journey(eng, La, a, Lb, b, opts) {
    opts = opts || {};
    const st = eng.state, gait = opts.gait;
    const optsAt = L => Object.assign({}, opts, { others: typeof opts.others === 'function' ? opts.others(L) : (L === La ? opts.others : null), pool: L === 0 && opts.pool });
    const walkLeg = (L, pts, seg) => ({ walk: pts, gait, L, z: 0, seg });
    if (La === Lb) {
      const r = route(eng, La, a, b, optsAt(La)); if (!r) return null;
      return { legs: [walkLeg(La, r, 0)], segs: [{ L: La, pts: r }], len: lenOf(r) };
    }
    if (!eng.stairFlights) return null;
    const dir = Lb > La ? 1 : -1;
    // states: where one could be on floor L, and how they got there
    let now = [{ L: La, pt: a, len: 0, legs: [], segs: [] }];
    for (let L = La; L !== Lb; L += dir) {
      const lower = dir > 0 ? L : L - 1, F = st.floors[lower];
      if (!F || !st.floors[L + dir]) return null;
      const next = [];
      F.stairs.forEach(s => {
        // up: walk to the foot (or beside the first tread) on L; down: walk to the top tread on L
        stairWays(eng, s, dir < 0).forEach(W => {
          const pcs = W.pieces, first = pcs[0].climb[0], last = pcs[pcs.length - 1].climb[1];
          if (!standable(eng, lower, dir > 0 ? first : last, optsAt(lower))) return;
          if (pcs.some(q => q.climb && q.steps === 1 && crossesWall(eng, lower, q.climb[0], q.climb[1]))) return;   // stepping on through a wall
          let best = null;
          now.forEach(S => {
            const r = route(eng, L, S.pt, first, optsAt(L)); if (!r) return;
            const len = S.len + lenOf(r);
            if (!best || len < best.len) best = { S, r, len };
          });
          if (!best) return;
          const legs = best.S.legs.concat([walkLeg(L, best.r, best.S.segs.length)]), segs = best.S.segs.concat([{ L, pts: best.r }]);
          let len = best.len;
          pcs.forEach(q => {
            if (q.climb) { legs.push({ climb: q.climb, z0: q.z0, z1: q.z1, steps: q.steps, down: !!q.down, L: lower, gait, seg: segs.length }); len += lenOf(q.climb) * 1.5; }
            else { legs.push({ walk: q.walk, gait, L: lower, z: q.z, landing: true, seg: segs.length }); len += lenOf(q.walk); }
          });
          next.push({ L: L + dir, pt: last, len, legs, segs });
        });
      });
      if (!next.length) return null;
      now = next;
    }
    let best = null;
    now.forEach(S => {
      const r = route(eng, Lb, S.pt, b, optsAt(Lb)); if (!r) return;
      const len = S.len + lenOf(r);
      if (!best || len < best.len) best = { S, r, len };
    });
    if (!best) return null;
    return { legs: best.S.legs.concat([walkLeg(Lb, best.r, best.S.segs.length)]), segs: best.S.segs.concat([{ L: Lb, pts: best.r }]), len: best.len };
  }

  /* ── things to do at the furniture ───────────────────────────────────
     pose: joints set over the standing pose; held: what is in the hands; armOver: that arm
     reaches over the piece (drawn on top of it when the person faces the camera); wiggle:
     joints that move while they do it, [degrees either way, seconds a swing] */
  const ACTS = {
    cooking:  { on: ['stove'], u: 0, v: 0.57, turn: 180, label: 'cooking', emoji: '🍳',
                pose: { shoulderR: 15, elbowR: 30, shoulderL: -15, elbowL: 100 }, held: { left: 'spoon', right: 'pan' }, armOver: 'right',
                wiggle: { elbowL: [14, 0.8], shoulderL: [6, 0.8] } },
    dishes:   { on: ['sink'], u: 0.05, v: 0.57, turn: 180, label: 'washing the dishes', emoji: '🍽️',
                pose: { shoulderR: 15, elbowR: 30, shoulderL: -12, elbowL: -30 }, armOver: 'right',
                wiggle: { shoulderR: [7, 0.5], elbowR: [10, 0.5], elbowL: [8, 0.6] } },
    // the washbasin is not in the deduction house: the same as at the sink, the same gap in front of it
    washing:  { on: ['washbasin'], u: 0, v: 0.495, turn: 180, label: 'washing their hands', emoji: '🧼',
                pose: { shoulderR: 15, elbowR: 30, shoulderL: -12, elbowL: -30 }, armOver: 'right',
                wiggle: { elbowR: [10, 0.45], elbowL: [10, 0.45] } },
    shower:   { on: ['shower'], u: 0, v: 0.37, turn: 0, label: 'taking a shower', emoji: '🚿',
                pose: { shoulderL: -150, elbowL: -60, shoulderR: 150, elbowR: 60 }, eyes: 'closed', swimwear: true,
                wiggle: { elbowL: [15, 0.7], elbowR: [15, 0.7] } },
    snack:    { on: ['fridge'], u: 0.05, v: 1.15, turn: 0, label: 'having a snack', emoji: '🍪',
                pose: { shoulderR: 40, elbowR: 50 }, held: { left: null, right: 'plate' },
                wiggle: { elbowR: [18, 1.6] } },
    // in front of a wardrobe: only the spot (the builder plays opening it, changing and shutting it)
    dress:    { on: ['wardrobe'], u: 0, v: 0.75, turn: 180, label: 'changing clothes', emoji: '👕', pose: {}, wiggle: {} }
  };
  const SWIM = { upperGarment: null, lowerGarment: 'swimshorts', footwear: null };
  const SWIM_F = { upperGarment: 'swimsuit', lowerGarment: null, footwear: null };
  const actMemo = new Map();
  function actPose(character, id, wig) {
    const A = ACTS[id]; if (!A) return null;
    const key = id + '|' + (wig || '') + '|' + (character.__hwKey || JSON.stringify(character));
    if (actMemo.has(key)) return actMemo.get(key);
    const H = HC(), d = H.normalize(character);
    if (A.swimwear) Object.assign(d, d.bodyType === 'female' ? SWIM_F : SWIM);
    H.applyPose(d, 'standing'); d.prop = null; d.back = false;
    Object.assign(d.joints, A.pose);
    if (A.held) d.held = Object.assign({}, A.held);
    if (A.eyes) d.eyes = A.eyes;
    if (wig) wig.split(',').forEach(p => { const [j, v] = p.split(':'); d.joints[j] = (d.joints[j] || 0) + Number(v); });
    const out = H.normalize(d);
    if (actMemo.size > 400) actMemo.delete(actMemo.keys().next().value);
    actMemo.set(key, out);
    return out;
  }
  const FD = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  function actSpot(fr, id) {
    const A = ACTS[id], [fx, fy] = FD[((fr.dir | 0) % 4 + 4) % 4];
    return { x: fr.cx + A.u * -fy + A.v * fx, y: fr.cy + A.u * fx + A.v * fy, facing: (((fr.dir | 0) * 90 + A.turn) % 360 + 360) % 360 };
  }
  // the wiggle at time t, as 'joint:degrees,…' (whole degrees, 12 steps a swing, so frames repeat)
  function wiggleAt(id, t, amount) {
    const A = ACTS[id]; if (!A || !A.wiggle) return '';
    return Object.entries(A.wiggle).map(([j, [amp, per]]) => {
      const ph = Math.round((t / per) * 12) / 12;
      return j + ':' + Math.round(amp * amount * Math.sin(ph * 2 * Math.PI));
    }).join(',');
  }
  // between two poses: joints the natural way, everything else (clothes, held things, eyes) at the middle
  function mix(dA, dB, u) {
    const H = HC(), e = H.ease(u, 'sine', 'sine'), d = H.normalize(u < 0.5 ? dA : dB);
    H.JOINTS.forEach(([j]) => { const a = dA.joints[j] || 0, b = dB.joints[j] || 0; d.joints[j] = Math.round(wrap(a) + H.jointDelta(j, a, b) * e); });
    ['torsoOrientation', 'pelvisOrientation'].forEach(k => { d[k] = Math.round((dA[k] || 0) + ((dB[k] || 0) - (dA[k] || 0)) * e); });
    return d;
  }

  /* ── a trip: legs played one after another ─────────────────────────── */
  const DEG = Math.PI / 180;
  const headingOf = (a, b) => ((Math.atan2(b[0] - a[0], -(b[1] - a[1])) / DEG) % 360 + 360) % 360;   // degrees clockwise from north
  const turnTo = (from, to) => ((to - from + 540) % 360) - 180;
  const TURN_RATE = 420;   // degrees a second, turning on the spot or at a corner
  /* a hand out to a door handle: the upper arm forward (closing: about half as far, from 8°
     standing), the forearm bent well up from the elbow */
  const REACH = { open: { shoulderR: 72, elbowR: 55, wristR: 0 }, close: { shoulderR: 40, elbowR: 55, wristR: 0 },
    flick: { shoulderR: 85, elbowR: 35, wristR: 0 },   // a light switch, at chest height
    high: { shoulderR: 130, elbowR: 25, wristR: 0 } };  // curtains or a blind, up at the top of the window
  function sizeOf(character) {
    // how tall they are, against an average adult: strides scale with it
    const H = HC(), d = H.normalize(character);
    const h = [0.76, 0.87, 0.93, 1, 1.05, 1.1][Math.max(0, Math.min(5, d.height | 0))] || 1;
    return h;
  }
  function trip(character, legs) {
    const H = HC();
    const c = H.normalize(character);
    c.__hwKey = JSON.stringify(c);
    const size = sizeOf(c);
    const standing = (() => { const d = H.normalize(c); H.applyPose(d, 'standing'); d.prop = null; d.back = false; return d; })();
    let facing = 180, x = 0, y = 0, t = 0, floor;
    const plan = [], events = [];
    for (const L of legs) {
      if (L.L != null) floor = L.L;
      const seg = L.seg;
      if (L.walk) {
        const pts = L.walk.filter((p, i, a) => !i || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 1e-3);
        if (pts.length < 2) continue;
        const gait = L.gait === 'running' ? 'running' : 'walking';
        const stride = (gait === 'running' ? 2.4 : 1.3) * size, cyc = frames(gait), fps = (ANIMS[gait] || { fps: 24 }).fps;
        // metres a second at the animation's own speed; across the water (from one spot in a pool to
        // another), about half that, sculling along
        const wet = !!(L.swimIn && L.swimIn(pts[0][0], pts[0][1]) && L.swimIn(pts[pts.length - 1][0], pts[pts.length - 1][1]));
        const speed = stride / (cyc / fps) * (wet ? 0.5 : 1);
        // distance along the route, and the heading of each piece
        const segs = []; let dist = 0;
        for (let i = 1; i < pts.length; i++) { const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push({ a: pts[i - 1], b: pts[i], d0: dist, len, h: headingOf(pts[i - 1], pts[i]) }); dist += len; }
        // turn first toward the way out, if that is a big turn
        const first = segs[0].h, big = Math.abs(turnTo(facing, first));
        if (big > 60) { const dur = big / TURN_RATE; plan.push({ kind: 'turn', t0: t, dur, x: pts[0][0], y: pts[0][1], f0: facing, f1: first, L: floor, zb: L.z || 0, seg, sink: L.swimIn && L.swimIn(pts[0][0], pts[0][1]) ? 1 : undefined }); t += dur; }   // (turning round in the pool: still swimming)
        plan.push({ kind: 'walk', t0: t, dur: dist / speed, segs, dist, gait, stride, cyc, speed, swimIn: L.swimIn, f0: big > 60 ? first : facing, L: floor, zb: L.z || 0, seg });
        t += dist / speed; facing = segs[segs.length - 1].h; [x, y] = pts[pts.length - 1];
      } else if (L.climb) {
        // up or down one flight: turn to it, then a step a tread
        const [a, b] = L.climb, h = headingOf(a, b), big = Math.abs(turnTo(facing, h));
        const id = L.down ? 'going-downstairs' : 'going-upstairs', A = ANIMS[id];
        if (big > 20) { const dur = big / TURN_RATE; plan.push({ kind: 'turn', t0: t, dur, x: a[0], y: a[1], f0: facing, f1: h, L: floor, zb: L.z0, seg }); t += dur; }
        const cyc = A ? frames(id) : 32, fps = A ? A.fps : 24, rate = L.gait === 'running' ? 1.7 : 1.2;
        const perStep = (cyc / 2) / (fps * rate), dur = Math.max(0.2, L.steps * perStep);
        plan.push({ kind: 'climb', t0: t, dur, id: A ? id : 'walking', a, b, z0: L.z0, z1: L.z1, steps: L.steps, cyc, f0: A ? footDown(id) : 0, facing: h, L: floor, seg });
        t += dur; [x, y] = b; facing = h;
      } else if (L.ladder) {
        // a pool ladder: facing the deck, a rung a step (going down, the climb played backwards)
        const [a, b] = L.ladder, h = L.up ? headingOf(a, b) : headingOf(b, a), big = Math.abs(turnTo(facing, h));
        if (big > 20) { const dur = big / TURN_RATE; plan.push({ kind: 'turn', t0: t, dur, x: a[0], y: a[1], f0: facing, f1: h, L: floor, zb: 0, seg, sink: L.up ? 1 : 0 }); t += dur; }
        const A = ANIMS['going-upstairs'], cyc = A ? frames('going-upstairs') : 32, fps = A ? A.fps : 24, steps = L.steps || 4;
        const dur = steps * (cyc / 2) / fps;
        plan.push({ kind: 'ladder', t0: t, dur, a, b, up: !!L.up, steps, cyc, f0: A ? footDown('going-upstairs') : 0, facing: h, L: floor, seg });
        t += dur; [x, y] = b; facing = h;
      } else if (L.reach) {
        // a hand out to a door handle and back; the door opens (or shuts) half way through
        if (L.x != null) { x = L.x; y = L.y; }
        if (L.facing != null) facing = L.facing;
        const dur = L.dur || 0.7;
        plan.push({ kind: 'reach', t0: t, dur, x, y, facing, L: floor, seg, action: L.reach, door: L.door });
        events.push({ t: t + dur / 2, door: L.door, L: floor, action: L.reach, toggle: L.toggle || null });
        t += dur;
      } else if (L.turn != null) {
        const f1 = ((L.turn % 360) + 360) % 360, big = Math.abs(turnTo(facing, f1));
        if (L.x != null) { x = L.x; y = L.y; }
        if (big > 1) { const dur = Math.max(0.15, big / TURN_RATE); plan.push({ kind: 'turn', t0: t, dur, x, y, f0: facing, f1, L: floor, zb: 0, seg }); t += dur; }
        facing = f1;
      } else if (L.play) {
        const A = ANIMS[L.play]; if (!A) continue;
        const n = A.length, dur = n / A.fps / (L.speed > 0 ? L.speed : 1);   // speed: faster (2) or slower than the animation's own
        if (L.facing != null) facing = L.facing;
        if (L.x != null) { x = L.x; y = L.y; }
        plan.push({ kind: 'play', t0: t, dur, id: L.play, n, x, y, facing, z: L.z || 0, L: floor, seg });
        t += dur;
        const end = pose(L.play, n, c), fx = Math.sin(facing * DEG), fy = -Math.cos(facing * DEG);
        x += -end.shift * fx; y += -end.shift * fy;   // a side view faces left: shift < 0 is forward
      } else if (L.act) {
        if (!ACTS[L.act]) continue;
        if (L.x != null) { x = L.x; y = L.y; }
        if (L.facing != null) facing = L.facing;
        const blend = L.blend || 0.5, doing = L.out ? 0 : (L.doing != null ? L.doing : 2);
        plan.push({ kind: 'act', t0: t, dur: blend + doing, blend, doing, out: !!L.out, id: L.act, x, y, facing, L: floor, seg });
        t += blend + doing;
      } else if (L.stand != null) {
        if (L.x != null) { x = L.x; y = L.y; }
        if (L.facing != null) facing = L.facing;
        plan.push({ kind: 'stand', t0: t, dur: L.stand, x, y, facing, d: L.d || null, L: floor, seg, tag: L.tag });
        t += L.stand;
      }
    }
    const total = t;
    function at(tt) {
      const r = at0(tt);
      const P = plan[r.leg];
      if (P) { if (P.L != null) r.L = P.L; r.seg = P.seg; }
      return r;
    }
    function at0(tt) {
      if (!plan.length) return { x, y, z: 0, facing, d: standing, leg: -1, u: 1, done: true };
      tt = Math.max(0, tt);
      let k = plan.findIndex(p => tt < p.t0 + p.dur);
      const done = k < 0; if (done) k = plan.length - 1;
      const P = plan[k], u = done ? 1 : Math.max(0, Math.min(1, (tt - P.t0) / (P.dur || 1)));
      if (P.kind === 'turn' && P.sink != null) return { x: P.x, y: P.y, z: 0, facing: (P.f0 + turnTo(P.f0, P.f1) * u + 360) % 360, d: standing, leg: k, u, done, kind: 'turn', swim: P.sink > 0, sink: P.sink };
      if (P.kind === 'ladder') {
        const s = u * P.steps, n = Math.floor(s * P.cyc / 2), frame = P.up ? (P.f0 + n) % P.cyc : ((P.f0 - n) % P.cyc + P.cyc) % P.cyc;
        const q = pose(ANIMS['going-upstairs'] ? 'going-upstairs' : 'walking', frame, c);
        return { x: P.a[0] + (P.b[0] - P.a[0]) * u, y: P.a[1] + (P.b[1] - P.a[1]) * u, z: 0, facing: P.facing, d: q.d, leg: k, u, done, kind: 'ladder', swim: true, sink: P.up ? 1 - u : u };
      }
      if (P.kind === 'turn') return { x: P.x, y: P.y, z: P.zb || 0, ground: P.zb || 0, facing: (P.f0 + turnTo(P.f0, P.f1) * u + 360) % 360, d: standing, leg: k, u, done, kind: 'turn' };
      if (P.kind === 'act') {
        const tt2 = tt - P.t0, steps = 10;
        let d;
        if (tt2 < P.blend && !done) {
          const v = Math.round((tt2 / P.blend) * steps) / steps, act = actPose(c, P.id);
          d = P.out ? mix(act, standing, v) : mix(standing, act, v);
        } else if (P.out) d = standing;
        else {
          const tw = tt2 - P.blend, amount = Math.min(1, tw / 0.4);   // the movement builds up
          d = actPose(c, P.id, done ? '' : wiggleAt(P.id, tw, Math.round(amount * 4) / 4));
        }
        return { x: P.x, y: P.y, z: 0, facing: P.facing, d, leg: k, u, done, kind: 'act', act: P.out && tt2 >= P.blend * 0.5 ? null : P.id };
      }
      if (P.kind === 'reach') {
        const v = Math.round(Math.sin(Math.PI * u) * 8) / 8;   // out and back
        return { x: P.x, y: P.y, z: 0, facing: P.facing, d: done ? standing : mix(standing, reachPose(P.action), v), leg: k, u, done, kind: 'reach' };
      }
      if (P.kind === 'stand') return { x: P.x, y: P.y, z: 0, facing: P.facing, d: P.d || standing, leg: k, u, done, kind: 'stand' };
      if (P.kind === 'play') {
        const f = Math.min(P.n, Math.floor(u * P.n)), q = pose(P.id, done ? P.n : f, c);
        const fx = Math.sin(P.facing * DEG), fy = -Math.cos(P.facing * DEG);
        return { x: P.x - q.shift * fx, y: P.y - q.shift * fy, z: P.z + q.lift, facing: P.facing, d: q.d, leg: k, u, done, kind: 'play' };
      }
      if (P.kind === 'climb') {
        // the body rises (or drops) a riser a step, with the animation's own lift on top
        const s = u * P.steps, px = P.a[0] + (P.b[0] - P.a[0]) * u, py = P.a[1] + (P.b[1] - P.a[1]) * u;
        const base = P.z0 + (P.z1 - P.z0) * u;
        const frame = (P.f0 + Math.floor(s * P.cyc / 2)) % P.cyc, q = pose(P.id, frame, c);
        return { x: px, y: py, z: base + q.lift, ground: base, facing: P.facing, d: q.d, leg: k, u, done, kind: 'climb', down: P.id === 'going-downstairs' };
      }
      // walking: where along the route, which way they face (eased round corners), which frame
      const s = Math.min(P.dist, u * P.dist);
      let i = 0; while (i < P.segs.length - 1 && s > P.segs[i].d0 + P.segs[i].len) i++;
      const S = P.segs[i], v = S.len ? (s - S.d0) / S.len : 1;
      const px = S.a[0] + (S.b[0] - S.a[0]) * v, py = S.a[1] + (S.b[1] - S.a[1]) * v;
      // turning at a corner takes a little time, shared before and after it
      let f = S.h;
      const ease = 0.35 * P.speed / 1.3;   // metres either side of a corner
      if (i > 0 && s - S.d0 < ease) { const prev = P.segs[i - 1].h, w = 0.5 + 0.5 * (s - S.d0) / ease; f = prev + turnTo(prev, S.h) * w; }
      else if (i < P.segs.length - 1 && S.d0 + S.len - s < ease) { const nx = P.segs[i + 1].h, w = 0.5 * (1 - (S.d0 + S.len - s) / ease); f = S.h + turnTo(S.h, nx) * w; }
      if (i === 0 && s < ease && P.f0 != null) { const w = s / ease; f = P.f0 + turnTo(P.f0, f) * Math.min(1, 0.5 + w / 2); }
      f = (f % 360 + 360) % 360;
      const swim = P.swimIn ? !!P.swimIn(px, py) : false;
      if (swim && ANIMS['treading-water']) {
        // in the water: treading water (sculling) as they move along, not walking
        const n = frames('treading-water'), q = pose('treading-water', Math.floor((P.t0 + u * P.dur) * (ANIMS['treading-water'].fps || 24)) % n, c);
        return { x: px, y: py, z: P.zb + q.lift, ground: P.zb, facing: f, d: q.d, leg: k, u, done, kind: 'walk', swim, gait: P.gait };
      }
      const [lo] = span(ANIMS[P.gait]);
      const frame = done ? lo : lo + Math.floor((s / P.stride) * P.cyc) % P.cyc;
      const q = pose(P.gait, frame, c);
      return { x: px, y: py, z: P.zb + q.lift, ground: P.zb, facing: f, d: done ? standing : q.d, leg: k, u, done, kind: 'walk', swim, gait: P.gait };
    }
    const reached = {};
    function reachPose(action) {
      // the right arm out in front, at handle height
      const a = REACH[action] ? action : 'open';
      if (!reached[a]) { reached[a] = H.normalize(standing); Object.assign(reached[a].joints, REACH[a]); }
      return reached[a];
    }
    return { seconds: total, at, plan, events, end: () => ({ x, y, facing }) };
  }

  global.HouseWalk = { ANIMS, ACTS, actPose: (c, id) => actPose(c, id), actSpot, add, load, compact, frames, pose, route, journey, standable, trip, headingOf, grid };
})(typeof window !== 'undefined' ? window : globalThis);
