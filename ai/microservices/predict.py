import argparse
import cv2
import numpy as np
import os
import tornado.ioloop
import tornado.web
from concurrent.futures import ThreadPoolExecutor

from ai.transformations import apply_transformations
from ai.utilities import load_model


class ModelMetadata(tornado.web.RequestHandler):

    executor = ThreadPoolExecutor(5)

    @tornado.concurrent.run_on_executor
    def get_metadata(self):
        result = {
            'model_id': self.application.model_id,
            'epoch_id': self.application.epoch_id,
            'angle_only': self.application.angle_only,
            'image_scale': self.application.image_scale,
            'crop_percent': self.application.crop_percent
        }
        return result

    @tornado.gen.coroutine
    def post(self):
        result = yield self.get_metadata()
        self.write(result)

class Health(tornado.web.RequestHandler):

    executor = ThreadPoolExecutor(5)

    @tornado.concurrent.run_on_executor
    def is_healthy(self):
        result = {
            'is_healthy': True
        }
        return result

    @tornado.gen.coroutine
    def get(self):
        result = yield self.is_healthy()
        self.write(result)

class PredictionHandler(tornado.web.RequestHandler):

    # Prevents awful blocking
    # https://infinitescript.com/2017/06/making-requests-non-blocking-in-tornado/
    executor = ThreadPoolExecutor(500)

    @tornado.concurrent.run_on_executor
    def get_prediction(self, file_body):
        # Ugly code to convert string to image
        # https://stackoverflow.com/questions/17170752/python-opencv-load-image-from-byte-string/17170855
        nparr = np.fromstring(file_body, np.uint8)
        img_np = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # TODO: Fix this bug. Right now if I don't pass mirror image, model outputs unchanging prediction
        flipped_image = cv2.flip(img_np, 1)
        normalized_images = [img_np, flipped_image]
        normalized_images = np.array(normalized_images)

        # Normalize for contrast and pixel size
        normalized_images = apply_transformations(
            images=normalized_images,
            image_scale=self.image_scale,
            crop_percent=self.crop_percent)

        prediction = self.prediction.eval(feed_dict={self.x: normalized_images}, session=self.sess).astype(float)

        # Ignore second prediction set, which is flipped image, a hack
        prediction = list(prediction[0])

        if self.angle_only == True:
            default_throttle = 0.6
            prediction.append(default_throttle)

        return prediction

    @property
    def prediction(self):
        return self._prediction

    @property
    def image_scale(self):
        return self._image_scale

    @property
    def crop_percent(self):
        return self._crop_percent

    @property
    def angle_only(self):
        return self._angle_only

    @prediction.setter
    def prediction(self,prediction):
        self._prediction = prediction

    @image_scale.setter
    def image_scale(self, image_scale):
        self._image_scale = image_scale

    @crop_percent.setter
    def crop_percent(self, crop_percent):
        self._crop_percent = crop_percent

    @angle_only.setter
    def angle_only(self, angle_only):
        self._angle_only = angle_only

    def initialize(self, sess, x, prediction, image_scale, crop_percent, angle_only):
        self.prediction = prediction
        self.sess = sess
        self.x = x
        self.image_scale = image_scale
        self.crop_percent = crop_percent
        self.angle_only = angle_only

    @property
    def sess(self):
        return self._sess

    @sess.setter
    def sess(self, sess):
        self._sess = sess

    @property
    def x(self):
        return self._x

    @x.setter
    def x(self, x):
        self._x = x

    @tornado.gen.coroutine
    def post(self):

        # I don't quite understand how this works. "image" is what
        # I called the key of the dict in the request json but
        # I think "body" is a built-in Tornado thing in the
        # tornado.HTTPFile class. Anyways, it works.
        file_body = self.request.files['image'][0]['body']

        prediction = yield self.get_prediction(file_body=file_body)

        # Result will look something like: '{"prediction": [0.4731147885322571, 0.25]}'
        result = {'prediction': prediction}
        print(result)
        self.write(result)


def make_app(sess, x, prediction, image_scale, crop_percent, angle_only):
    return tornado.web.Application(
        [(r"/predict",PredictionHandler,
          {'sess':sess,
           'x':x,
           'prediction':prediction,
           'image_scale':image_scale,
           'crop_percent':crop_percent,
           'angle_only':angle_only}),
         (r"/model-metadata", ModelMetadata),
        (r"/health", Health)])


if __name__ == "__main__":

    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--checkpoint_dir",
        required=False,
        help="path to all of the data",
        #default='/Users/ryanzotti/Documents/Data/Self-Driving-Car/printer-paper/data/tf_visual_data/runs/14/checkpoints')
        default='/root/ai/model-archives/model/checkpoints')
    ap.add_argument(
        "--image_scale",
        required=True,
        help="Resize image scale")
    ap.add_argument(
        "--port",
        required=False,
        help="Serer port to use",
        default=8885)
    ap.add_argument(
        "--angle_only",
        required=False,
        help="Should model output only angle (Y/n)",
        default='y')
    ap.add_argument(
        "--model_id",
        required=True,
        help="Unique identifier for the model")
    ap.add_argument(
        "--epoch",
        required=True,
        help="The model epoch, which is used as a means to version the model")
    ap.add_argument(
        "--crop_percent",
        required=False,
        help="Percent of image top that is cut")
    args = vars(ap.parse_args())
    path = args['checkpoint_dir']
    if 'y' in args['angle_only'].lower():
        args['angle_only'] = True
    else:
        args['angle_only'] = False
    angle_only = args['angle_only']
    image_scale = float(args['image_scale'])
    crop_percent = float(args['crop_percent'])
    port=args['port']
    model_id = args['model_id']
    epoch_id = args['epoch']

    # Load model just once and store in memory for all future calls
    sess, x, prediction = load_model(path)

    app = make_app(sess, x, prediction,image_scale, crop_percent, angle_only)
    app.model_id = int(model_id)
    app.epoch_id = int(epoch_id)
    app.angle_only = angle_only
    app.image_scale = int(image_scale)
    app.crop_percent = int(crop_percent)
    app.listen(port)
    tornado.ioloop.IOLoop.current().start()
