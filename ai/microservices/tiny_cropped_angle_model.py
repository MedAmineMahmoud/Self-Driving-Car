import tensorflow as tf
from ai.Trainer import Trainer, parse_args
import os
from ai.tf_ops import *


args = parse_args()
data_path = args["datapath"]
postgres_host = args["postgres-host"]
epochs = args["epochs"]
s3_bucket = args['s3_bucket']
port = args['port']
show_speed = args['show_speed']
s3_sync = args['s3_sync']
save_to_disk = args['save_to_disk']
image_scale = args['image_scale']
crop_percent = args['crop_percent']

sess = tf.InteractiveSession(config=tf.ConfigProto())


height_pixels = int((240 * (crop_percent / 100.0)) / image_scale)
width_pixels = int(320 / image_scale)

x = tf.placeholder(tf.float32, shape=[None, height_pixels, width_pixels, 3], name='x')
y_ = tf.placeholder(tf.float32, shape=[None, 1], name='y_')
phase = tf.placeholder(tf.bool, name='phase')

conv1 = batch_norm_conv_layer('layer1', x, [3, 3, 3, 32], phase)
conv2 = batch_norm_conv_layer('layer2',conv1, [3, 3, 32, 32], phase)

h_pool4_flat = tf.reshape(conv2, [-1, height_pixels * width_pixels * 32])
h5 = batch_norm_fc_layer('layer5',h_pool4_flat, [height_pixels * width_pixels * 32, 64], phase)

W_final = weight_variable('layer8',[64, 1])
b_final = bias_variable('layer8',[1])
pre_clipped_logits = tf.add(tf.matmul(h5, W_final), b_final, name='pre_clipped_logits')


# Forces predictions to fall within acceptable ranges to
# avoid exploding rmse loss values that penalize max angle
clipped_logits = tf.clip_by_value(
    t=pre_clipped_logits,
    clip_value_min=-1,
    clip_value_max=1,
    name='logits')

# TODO: Fix this x.shape[0] bug
rmse = tf.sqrt(tf.reduce_mean(tf.squared_difference(clipped_logits, y_)),name='loss')

train_step = tf.train.AdamOptimizer(1e-4,name='train_step').minimize(rmse)

'''
    https://github.com/tensorflow/tensorflow/blob/master/tensorflow/contrib/layers/python/layers/layers.py#L396
    From the official TensorFlow docs:

        Note: When is_training is True the moving_mean and moving_variance need to be
        updated, by default the update_ops are placed in `tf.GraphKeys.UPDATE_OPS` so
        they need to be added as a dependency to the `train_op`, example:

            update_ops = tf.get_collection(tf.GraphKeys.UPDATE_OPS)
            with tf.control_dependencies(update_ops):
              train_op = optimizer.minimize(loss)

    https://www.tensorflow.org/api_docs/python/tf/Graph#control_dependencies
    Regarding tf.control_dependencies:

        with g.control_dependencies([a, b, c]):
          # `d` and `e` will only run after `a`, `b`, and `c` have executed.
          d = ...
          e = ...

'''
update_ops = tf.get_collection(tf.GraphKeys.UPDATE_OPS)
with tf.control_dependencies(update_ops):
    train_step = tf.train.AdamOptimizer(1e-5).minimize(rmse)

model_file = os.path.dirname(os.path.realpath(__file__)) + '/' + os.path.basename(__file__)
trainer = Trainer(data_path=data_path,
                  postgres_host=postgres_host,
                  model_file=model_file,
                  s3_bucket=s3_bucket,
                  port=port,
                  epochs=epochs,
                  max_sample_records=100,
                  show_speed=show_speed,
                  s3_sync=s3_sync,
                  save_to_disk=save_to_disk,
                  image_scale=image_scale,
                  crop_percent=crop_percent,
                  angle_only=True)
trainer.train(sess=sess, x=x, y_=y_,
              optimization=rmse,
              train_step=train_step,
              train_feed_dict={'phase:0': True},
              test_feed_dict={})
