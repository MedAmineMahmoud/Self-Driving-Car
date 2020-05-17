"""
CAR CONFIG
This file is read by your car application's manage.py script to change the car
performance.
EXMAPLE
-----------
import dk
cfg = dk.load_config(config_path='~/d2/config.py')
print(cfg.CAMERA_RESOLUTION)
"""


import os

PI_HOSTNAME = 'ffmpeg'
WEB_UI_PORT = 8884
WEB_AI_PORT = 8888
WARM_UP_SECONDS = 3

# Provide entire endpoint since host, http(s), port, or url could change
MODEL_API = 'http://Ryans-MacBook-Pro.local:8885/predict'
UI_API = 'http://ryanzotti.local:{port}/get-state'

# Model / AI outputs
ANGLE_ONLY = True

# How much to scale the image for the AI
IMAGE_SCALE = 0.0625
CROP_FACTOR = 3

#PATHS
CAR_PATH = PACKAGE_PATH = os.path.dirname(os.path.realpath(__file__))
DATA_PATH = os.path.join(CAR_PATH, 'data')
MODELS_PATH = os.path.join(CAR_PATH, 'model')

#VEHICLE
DRIVE_LOOP_HZ = 20
MAX_LOOPS = 100000

#CAMERA
CAMERA_RESOLUTION = (120, 160) #(height, width)
CAMERA_FRAMERATE = DRIVE_LOOP_HZ

#STEERING
STEERING_CHANNEL = 1
STEERING_LEFT_PWM = 420
STEERING_RIGHT_PWM = 360

#THROTTLE
THROTTLE_CHANNEL = 0
THROTTLE_FORWARD_PWM = 400
THROTTLE_STOPPED_PWM = 360
THROTTLE_REVERSE_PWM = 310

#TRAINING
BATCH_SIZE = 128
TRAIN_TEST_SPLIT = 0.8

#JOYSTICK
USE_JOYSTICK_AS_DEFAULT = False
JOYSTICK_MAX_THROTTLE = 0.25
JOYSTICK_STEERING_SCALE = 1.0
AUTO_RECORD_ON_THROTTLE = True