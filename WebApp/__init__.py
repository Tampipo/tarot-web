import dash
from dash import dcc
from dash import html
import dash_bootstrap_components as dbc
from dash.dependencies import Input, Output, State, ClientsideFunction
import plotly.express as px
import base64

import sys
import os
import pandas as pd 

PACKAGE_PARENT = '..'
SCRIPT_DIR = os.path.dirname(os.path.realpath(os.path.join(os.getcwd(), os.path.expanduser(__file__))))
sys.path.append(os.path.normpath(os.path.join(SCRIPT_DIR, PACKAGE_PARENT)))



#images
ico_directory = 'ico/'

image_cards = ico_directory + 'cards.png'
encoded_image_cards = base64.b64encode(open(image_cards, 'rb').read())

#database

database_path = 'database/'

if not os.path.exists(database_path):
    os.makedirs(database_path)
else: 
    if not os.path.exists(os.path.join(database_path, 'players.csv')):
        #create players database
        with open(os.path.join(database_path, 'players.csv'), 'w') as f:
            f.write('ID,Name,Surname,Email\n')
    if not os.path.exists(os.path.join(database_path, 'games.csv')):
        #create games database
        with open(os.path.join(database_path, 'games.csv'), 'w') as f:
            f.write('ID,Date,Players,Score\n')
    # if not os.path.exists(os.path.join(database_path, 'scores.csv')):
    #     #create games database
    #     with open(os.path.join(database_path, 'scores.csv'), 'w') as f:
    #         f.write('ID,ScoreMonth,ScoreAllTime\n')
    if not os.path.exists(os.path.join(database_path, 'stats.csv')):
        #create games database
        with open(os.path.join(database_path, 'stats.csv'), 'w') as f:
            f.write('ID,Ngames,Score,Mean,Std,Taker,,BiggestWin,Biggestloss\n')
    