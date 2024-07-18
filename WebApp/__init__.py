import dash
from dash import dcc
from dash import html
import dash_bootstrap_components as dbc
from dash.dependencies import Input, Output, State, ClientsideFunction
import plotly.express as px
import base64

import sys
import os

PACKAGE_PARENT = '..'
SCRIPT_DIR = os.path.dirname(os.path.realpath(os.path.join(os.getcwd(), os.path.expanduser(__file__))))
sys.path.append(os.path.normpath(os.path.join(SCRIPT_DIR, PACKAGE_PARENT)))



#images
ico_directory = 'ico/'

image_cards = ico_directory + 'cards.png'
encoded_image_cards = base64.b64encode(open(image_cards, 'rb').read())

